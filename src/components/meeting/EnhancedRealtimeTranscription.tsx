
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Settings, Users, Zap, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VideoNameExtractor } from '@/utils/videoNameExtractor';
import { RealSpeakerIdentifier } from '@/utils/realSpeakerIdentifier';

interface TranscriptionEntry {
  id: string;
  timestamp: number;
  speaker: string;
  speakerId: string;
  text: string;
  confidence: number;
  audioLevel: number;
  isFinal: boolean;
}

interface EnhancedRealtimeTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  onTranscriptionUpdate: (segments: TranscriptionEntry[]) => void;
}

export const EnhancedRealtimeTranscription: React.FC<EnhancedRealtimeTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  onTranscriptionUpdate
}) => {
  const [transcriptionEntries, setTranscriptionEntries] = useState<TranscriptionEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentInterimText, setCurrentInterimText] = useState('');
  const [identifiedSpeakers, setIdentifiedSpeakers] = useState<Array<{id: string, name: string}>>([]);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const videoNameExtractorRef = useRef<VideoNameExtractor | null>(null);
  const speakerIdentifierRef = useRef<RealSpeakerIdentifier | null>(null);
  const lastSpeechTime = useRef<number>(0);

  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeTranscription();
    } else {
      cleanupTranscription();
    }

    return () => {
      cleanupTranscription();
    };
  }, [isRecording, mediaStream, meetingId]);

  const initializeTranscription = async () => {
    try {
      console.log('🚀 Initializing video-integrated transcription...');
      
      // Setup video capture and name extraction
      if (mediaStream) {
        // Create video element for analysis
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.play();
        setVideoElement(video);

        // Initialize video name extractor
        videoNameExtractorRef.current = new VideoNameExtractor();
        await videoNameExtractorRef.current.initialize(video);

        // Initialize speaker identifier with video integration
        speakerIdentifierRef.current = new RealSpeakerIdentifier(videoNameExtractorRef.current);

        // Setup audio analysis
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        
        console.log('✅ Video and audio analysis setup complete');
      }

      // Setup speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognitionConstructor();
        
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 1;
        
        recognitionRef.current.onstart = () => {
          console.log('🎤 Speech recognition started');
          setIsConnected(true);
        };
        
        recognitionRef.current.onresult = (event) => {
          handleSpeechRecognitionResult(event);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('❌ Speech recognition error:', event.error);
          
          // Auto-restart on certain errors
          if (event.error === 'network' || event.error === 'no-speech') {
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 1000);
          }
        };
        
        recognitionRef.current.onend = () => {
          console.log('🔄 Speech recognition ended, restarting...');
          // Auto-restart if still recording
          if (isRecording && recognitionRef.current) {
            setTimeout(() => {
              recognitionRef.current!.start();
            }, 100);
          }
        };
        
        recognitionRef.current.start();
        console.log('✅ Speech recognition initialized');
        
      } else {
        console.error('❌ Speech recognition not supported');
        throw new Error('Speech recognition not supported in this browser');
      }

      // Start monitoring identified speakers
      const speakerInterval = setInterval(() => {
        if (videoNameExtractorRef.current) {
          const speakers = videoNameExtractorRef.current.getAllSpeakers();
          setIdentifiedSpeakers(speakers);
        }
      }, 2000);

      return () => clearInterval(speakerInterval);

    } catch (error) {
      console.error('❌ Transcription initialization failed:', error);
      setIsConnected(false);
    }
  };

  const handleSpeechRecognitionResult = (event: SpeechRecognitionEvent) => {
    const currentTime = Date.now();
    const audioLevel = getAudioLevel();
    
    // Get current speaker from video-based identification
    let currentSpeaker = 'Unknown Speaker';
    if (speakerIdentifierRef.current) {
      currentSpeaker = speakerIdentifierRef.current.identifySpeaker(audioLevel, currentTime);
    }
    
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.85;
      
      if (result.isFinal) {
        finalTranscript += transcript;
        
        // Create final transcription entry
        const entry: TranscriptionEntry = {
          id: `${currentTime}_${i}_${Math.random()}`,
          timestamp: currentTime,
          speaker: currentSpeaker,
          speakerId: currentSpeaker.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          text: transcript.trim(),
          confidence: confidence,
          audioLevel: audioLevel,
          isFinal: true
        };
        
        if (transcript.trim()) {
          addTranscriptionEntry(entry);
          console.log(`💬 ${currentSpeaker}: ${transcript.trim()}`);
        }
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Update interim text display with current speaker
    if (interimTranscript.trim()) {
      setCurrentInterimText(`${currentSpeaker}: ${interimTranscript}`);
    } else {
      setCurrentInterimText('');
    }
  };

  const getAudioLevel = (): number => {
    if (!analyserRef.current) return 0;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255;
  };

  const addTranscriptionEntry = (entry: TranscriptionEntry) => {
    setTranscriptionEntries(prev => {
      const updated = [...prev, entry];
      onTranscriptionUpdate(updated);
      
      // Save to database
      if (meetingId) {
        saveTranscriptionEntry(entry);
      }
      
      return updated;
    });
  };

  const saveTranscriptionEntry = async (entry: TranscriptionEntry) => {
    try {
      await supabase
        .from('transcription_segments')
        .insert({
          meeting_id: meetingId,
          speaker_name: entry.speaker,
          speaker_id: entry.speakerId,
          text: entry.text,
          start_time: entry.timestamp / 1000,
          end_time: (entry.timestamp / 1000) + 3,
          confidence: entry.confidence,
          is_final: entry.isFinal
        });
    } catch (error) {
      console.error('Error saving transcription:', error);
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
    if (videoNameExtractorRef.current) {
      videoNameExtractorRef.current.cleanup();
      videoNameExtractorRef.current = null;
    }
    if (speakerIdentifierRef.current) {
      speakerIdentifierRef.current.reset();
      speakerIdentifierRef.current = null;
    }
    setIsConnected(false);
    setCurrentInterimText('');
    setIdentifiedSpeakers([]);
    console.log('🧹 Transcription cleaned up');
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
    ];
    
    const speakerIndex = speaker.charCodeAt(0) % colors.length;
    return colors[speakerIndex];
  };

  // Group transcription entries by speaker and time for better display
  const groupedEntries = transcriptionEntries.reduce((groups, entry) => {
    const key = `${entry.speaker}_${Math.floor(entry.timestamp / 5000)}`; // Group by 5-second intervals
    if (!groups[key]) {
      groups[key] = {
        speaker: entry.speaker,
        speakerId: entry.speakerId,
        timestamp: entry.timestamp,
        texts: [],
        confidence: 0,
        audioLevel: 0
      };
    }
    groups[key].texts.push(entry.text);
    groups[key].confidence = Math.max(groups[key].confidence, entry.confidence);
    groups[key].audioLevel = Math.max(groups[key].audioLevel, entry.audioLevel);
    return groups;
  }, {} as Record<string, any>);

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-blue-500" />
            <span>Video-Integrated Live Transcription</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
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
          </div>
        </CardTitle>
        
        {/* Identified Speakers Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Identified Speakers:</span>
            {identifiedSpeakers.length > 0 ? (
              identifiedSpeakers.map((speaker, index) => (
                <Badge key={speaker.id} variant="outline" className={getSpeakerColor(speaker.name)}>
                  <Users className="w-3 h-3 mr-1" />
                  {speaker.name}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-gray-500">
                <Users className="w-3 h-3 mr-1" />
                Detecting...
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b bg-gray-50 dark:bg-gray-800 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p>• Video-based speaker identification from meeting participants</p>
              <p>• Real-time transcription for all detected speakers</p>
              <p>• Automatic speaker name extraction from video highlights</p>
            </div>
          </div>
        )}
        
        {/* Transcription Display */}
        <ScrollArea className="h-64 p-4">
          {Object.keys(groupedEntries).length > 0 || currentInterimText ? (
            <div className="space-y-4">
              {Object.values(groupedEntries).map((group: any, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getSpeakerColor(group.speaker)}>
                      <Users className="w-3 h-3 mr-1" />
                      {group.speaker}
                    </Badge>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{new Date(group.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{Math.round(group.confidence * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {group.texts.join(' ')}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-green-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${group.audioLevel * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              
              {/* Live interim text */}
              {currentInterimText && (
                <div className="space-y-2 opacity-70">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                      <Volume2 className="w-3 h-3 mr-1" />
                      Speaking...
                    </Badge>
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    {currentInterimText}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Video className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording && isConnected ? 'Analyzing Video & Listening...' : 'Ready for Video Transcription'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {isRecording && isConnected
                  ? 'Detecting speakers from video and transcribing their speech'
                  : 'Start recording to begin video-integrated transcription'
                }
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>📹 Video-based speaker identification</div>
                <div>🎤 Real-time speech recognition</div>
                <div>👥 Multi-speaker support</div>
                <div>💬 Live transcript display</div>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
