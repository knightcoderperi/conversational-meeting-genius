
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [currentSpeaker, setCurrentSpeaker] = useState('Speaker 1');
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
      // For demo purposes, we'll simulate transcription
      // In production, integrate with Deepgram WebSocket API
      startMockTranscription();
    } catch (error) {
      console.error('Error initializing transcription:', error);
    }
  };

  const startMockTranscription = () => {
    // Mock transcription for demo
    const mockSegments = [
      { text: "Welcome everyone to today's meeting. Let's start with the agenda.", speaker: "Speaker 1" },
      { text: "Thank you for joining. I'd like to discuss the quarterly results first.", speaker: "Speaker 2" },
      { text: "The numbers look good this quarter. Revenue is up 15% compared to last quarter.", speaker: "Speaker 1" },
      { text: "That's excellent news. What about our key performance indicators?", speaker: "Speaker 3" },
      { text: "Customer satisfaction is at 92%, which is our highest ever.", speaker: "Speaker 2" },
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < mockSegments.length && isRecording) {
        const segment: TranscriptionSegment = {
          id: Date.now().toString() + index,
          speaker: mockSegments[index].speaker,
          text: mockSegments[index].text,
          confidence: 0.85 + Math.random() * 0.15,
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

        index++;
      } else {
        clearInterval(interval);
      }
    }, 3000 + Math.random() * 2000); // Random intervals between 3-5 seconds

    // Store interval reference for cleanup
    return () => clearInterval(interval);
  };

  const saveTranscriptionSegment = async (meetingId: string, segment: TranscriptionSegment) => {
    try {
      await supabase
        .from('transcription_segments')
        .insert({
          meeting_id: meetingId,
          speaker_name: segment.speaker,
          speaker_id: segment.speaker.toLowerCase().replace(' ', '_'),
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
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsConnected(false);
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = {
      'Speaker 1': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Speaker 2': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Speaker 3': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Speaker 4': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };
    return colors[speaker as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
            {isRecording ? (
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
          {segments.length > 0 ? (
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording ? 'Listening...' : 'Ready to transcribe'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isRecording 
                  ? 'Transcription will appear here as people speak'
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
