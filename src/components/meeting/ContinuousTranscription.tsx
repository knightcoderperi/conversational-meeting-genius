import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface SpeakerInfo {
  id: string;
  name: string;
  confidence: number;
  lastSeen: number;
}

interface ContinuousTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  detectedSpeakers: SpeakerInfo[];
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const ContinuousTranscription: React.FC<ContinuousTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  detectedSpeakers,
  onTranscriptionUpdate
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transcriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeContinuousTranscription();
    } else {
      cleanupTranscription();
    }

    return () => {
      cleanupTranscription();
    };
  }, [isRecording, mediaStream, meetingId]);

  // Update current speaker based on audio activity and detected speakers
  useEffect(() => {
    if (detectedSpeakers.length > 0) {
      const mostRecentSpeaker = detectedSpeakers.reduce((latest, speaker) => 
        speaker.lastSeen > latest.lastSeen ? speaker : latest
      );
      setCurrentSpeaker(mostRecentSpeaker.name);
    }
  }, [detectedSpeakers]);

  const initializeContinuousTranscription = async () => {
    try {
      console.log('Initializing continuous transcription...');
      
      // Set up audio analysis for speaker activity detection
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;

      if (mediaStream) {
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioContextRef.current.createMediaStreamSource(
            new MediaStream([audioTracks[0]])
          );
          source.connect(analyserRef.current);
        }
      }

      // Initialize Web Speech API with continuous recognition
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        
        // Configuration for continuous transcription
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 3;
        
        recognitionRef.current.onresult = async (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence || 0.85;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
              
              // Determine current speaker
              const speakerName = getCurrentSpeakerName();
              
              const segment: TranscriptionSegment = {
                id: Date.now().toString() + Math.random(),
                speaker: speakerName,
                text: transcript.trim(),
                confidence: confidence,
                timestamp: new Date().toLocaleTimeString(),
                isFinal: true
              };
              
              // Update segments
              setSegments(prev => {
                const updated = [...prev, segment];
                onTranscriptionUpdate(updated);
                return updated;
              });

              // Enhanced transcription with speaker analysis
              await processTranscriptionWithSpeaker(segment);
              
              // Save to database
              if (meetingId) {
                await saveTranscriptionSegment(meetingId, segment);
              }
            } else {
              interimTranscript += transcript;
            }
          }
          
          setCurrentText(interimTranscript);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          
          // Auto-restart on certain errors to maintain continuous transcription
          if (event.error === 'network' || event.error === 'audio-capture') {
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 1000);
          }
        };

        recognitionRef.current.onend = () => {
          // Auto-restart recognition to maintain continuous transcription
          if (isRecording) {
            setTimeout(() => {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 100);
          }
        };

        recognitionRef.current.start();
        setIsConnected(true);
        
        console.log('Continuous speech recognition started');
      } else {
        console.error('Speech recognition not supported');
      }

    } catch (error) {
      console.error('Error initializing continuous transcription:', error);
    }
  };

  const getCurrentSpeakerName = (): string => {
    if (currentSpeaker) {
      return currentSpeaker;
    }
    
    // Analyze audio activity to determine speaker
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isHighActivity = average > 50; // Threshold for active speaking
      
      if (isHighActivity && detectedSpeakers.length > 0) {
        // Return the most recently detected speaker
        const recentSpeaker = detectedSpeakers.reduce((latest, speaker) => 
          speaker.lastSeen > latest.lastSeen ? speaker : latest
        );
        return recentSpeaker.name;
      }
    }
    
    return detectedSpeakers.length > 0 ? detectedSpeakers[0].name : 'Main Speaker';
  };

  const processTranscriptionWithSpeaker = async (segment: TranscriptionSegment) => {
    try {
      // Enhanced processing with AI-powered speaker analysis
      const audioData = await captureAudioSegment();
      
      const { data, error } = await supabase.functions.invoke('enhance-transcription', {
        body: {
          segment: segment,
          audioData: audioData,
          meetingId: meetingId,
          contextSegments: segments.slice(-5) // Last 5 segments for context
        }
      });

      if (!error && data && data.enhancedSegment) {
        // Update segment with enhanced information
        setSegments(prev => 
          prev.map(s => s.id === segment.id ? { ...s, ...data.enhancedSegment } : s)
        );
      }
    } catch (error) {
      console.error('Error enhancing transcription:', error);
    }
  };

  const captureAudioSegment = async (): Promise<number[]> => {
    if (!analyserRef.current) return [];
    
    const dataArray = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(dataArray);
    return Array.from(dataArray);
  };

  const saveTranscriptionSegment = async (meetingId: string, segment: TranscriptionSegment) => {
    try {
      await supabase
        .from('transcription_segments')
        .insert({
          meeting_id: meetingId,
          speaker_name: segment.speaker,
          speaker_id: segment.speaker.toLowerCase().replace(/\s+/g, '_'),
          text: segment.text,
          start_time: Date.now() / 1000,
          end_time: Date.now() / 1000 + 3,
          confidence: segment.confidence,
          is_final: segment.isFinal,
          language: 'en'
        });
    } catch (error) {
      console.error('Error saving transcription segment:', error);
    }
  };

  const cleanupTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (transcriptionTimeoutRef.current) {
      clearTimeout(transcriptionTimeoutRef.current);
    }
    setIsConnected(false);
    setCurrentText('');
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    ];
    
    const index = speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>Continuous Transcription</span>
          </div>
          <div className="flex items-center space-x-2">
            {isRecording && isConnected ? (
              <Badge variant="default" className="bg-green-600">
                <Volume2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <MicOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
            <Badge variant="outline">
              <Users className="w-3 h-3 mr-1" />
              {detectedSpeakers.length} speakers
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80 p-4">
          {segments.length > 0 || currentText ? (
            <div className="space-y-4">
              {segments.map((segment) => (
                <div key={segment.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getSpeakerColor(segment.speaker)}>
                      {segment.speaker}
                    </Badge>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{segment.timestamp}</span>
                      <span>•</span>
                      <span>{Math.round(segment.confidence * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {segment.text}
                  </p>
                </div>
              ))}
              
              {currentText && (
                <div className="space-y-2 opacity-70 border-l-2 border-yellow-400 pl-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                      {getCurrentSpeakerName()} - Speaking...
                    </Badge>
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    {currentText}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording && isConnected ? 'Listening continuously...' : 'Ready for continuous transcription'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isRecording && isConnected
                  ? 'All speakers will be transcribed until the meeting ends'
                  : 'Start recording to begin continuous transcription'
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};