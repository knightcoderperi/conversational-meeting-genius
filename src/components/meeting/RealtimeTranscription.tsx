
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AudioProcessor, SpeakerIdentifier } from '@/utils/audioProcessor';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface RealtimeTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const RealtimeTranscription: React.FC<RealtimeTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  onTranscriptionUpdate
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const speakerIdentifierRef = useRef<SpeakerIdentifier | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      console.log('Initializing real-time transcription...');
      
      // Initialize speaker identifier with a single speaker
      speakerIdentifierRef.current = new SpeakerIdentifier();
      
      // Initialize audio processor
      audioProcessorRef.current = new AudioProcessor((audioData) => {
        if (speakerIdentifierRef.current) {
          speakerIdentifierRef.current.identifySpeaker(audioData);
        }
      });

      if (mediaStream) {
        await audioProcessorRef.current.startProcessing(mediaStream);
      }

      // Initialize Web Speech API for transcription
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
              
              // Get current speaker (always the same person in this case)
              const currentSpeaker = speakerIdentifierRef.current?.getCurrentSpeaker() || 'Main Speaker';
              
              const segment: TranscriptionSegment = {
                id: Date.now().toString() + Math.random(),
                speaker: currentSpeaker,
                text: transcript.trim(),
                confidence: confidence || 0.85,
                timestamp: new Date().toLocaleTimeString(),
                isFinal: true
              };
              
              setSegments(prev => {
                const updated = [...prev, segment];
                onTranscriptionUpdate(updated);
                return updated;
              });

              // Save to database
              if (meetingId) {
                saveTranscriptionSegment(meetingId, segment);
              }
            } else {
              interimTranscript += transcript;
            }
          }
          
          setCurrentText(interimTranscript);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
        };

        recognitionRef.current.start();
        setIsConnected(true);
        
        console.log('Speech recognition started');
      } else {
        console.error('Speech recognition not supported');
      }

    } catch (error) {
      console.error('Error initializing transcription:', error);
    }
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
          is_final: segment.isFinal
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
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
      audioProcessorRef.current = null;
    }
    setIsConnected(false);
    setCurrentText('');
  };

  const getSpeakerColor = (speaker: string) => {
    // Since we're using one speaker, use a consistent color
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  };

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>Live Transcription</span>
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
                <div className="space-y-2 opacity-70">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                      Speaking...
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
                {isRecording && isConnected ? 'Listening...' : 'Ready to transcribe'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isRecording && isConnected
                  ? 'Speak to see live transcription'
                  : 'Start recording to begin live transcription'
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
