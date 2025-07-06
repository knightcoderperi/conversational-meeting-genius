import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2, Users, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface MeetingTabAudioCaptureProps {
  meetingId: string;
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const MeetingTabAudioCapture: React.FC<MeetingTabAudioCaptureProps> = ({
  meetingId,
  onTranscriptionUpdate
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  const startTabAudioCapture = async () => {
    try {
      console.log('Starting tab audio capture for all meeting participants...');
      
      // Request display media with system audio - this captures ALL meeting participants
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false, // We only need audio
        audio: {
          echoCancellation: false, // Keep original meeting audio
          noiseSuppression: false, // Don't filter out other speakers
          autoGainControl: false,   // Preserve volume levels
          sampleRate: 44100,        // High quality audio
          channelCount: 2           // Stereo for better speaker separation
        }
      });

      // Verify we got audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available. Make sure to select "Share tab" and check "Share tab audio"');
      }

      console.log(`Captured ${audioTracks.length} audio tracks from meeting tab`);
      
      mediaStreamRef.current = stream;
      
      // Set up MediaRecorder for chunked processing
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Process audio in chunks for real-time transcription
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Process this chunk for transcription
          const audioBlob = new Blob([event.data], { type: 'audio/webm' });
          await processAudioChunk(audioBlob);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Audio capture stopped');
      };

      // Start recording in 2-second chunks for real-time processing
      mediaRecorder.start(2000);
      setIsCapturing(true);
      
      toast.success('Capturing audio from ALL meeting participants!');

      // Handle stream end (user stops sharing)
      stream.getVideoTracks().forEach(track => {
        track.addEventListener('ended', stopCapture);
      });
      
      stream.getAudioTracks().forEach(track => {
        track.addEventListener('ended', stopCapture);
      });

    } catch (error) {
      console.error('Failed to start tab audio capture:', error);
      toast.error('Failed to capture meeting audio. Make sure to select "Share tab" and enable "Share tab audio"');
    }
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64 for API transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Send to our enhanced transcription service
      const { data, error } = await supabase.functions.invoke('enhance-transcription', {
        body: {
          audio: base64Audio,
          meetingId: meetingId,
          enableSpeakerDiarization: true,
          realtime: true
        }
      });

      if (error) {
        console.error('Transcription error:', error);
        return;
      }

      if (data && data.segments) {
        // Update segments with new transcriptions
        const newSegments = data.segments.map((segment: any) => ({
          id: `${Date.now()}_${Math.random()}`,
          speaker: segment.speaker || 'Unknown Speaker',
          text: segment.text,
          confidence: segment.confidence || 0.9,
          timestamp: new Date().toLocaleTimeString(),
          isFinal: segment.is_final || false
        }));

        setSegments(prev => {
          const updated = [...prev, ...newSegments];
          onTranscriptionUpdate(updated);
          return updated;
        });

        // Update active speakers
        const speakers = newSegments.map((s: TranscriptionSegment) => s.speaker);
        setActiveSpeakers(prev => {
          const allSpeakers = [...new Set([...prev, ...speakers])];
          return allSpeakers.slice(-5); // Keep last 5 active speakers
        });

        // Update current text for live preview
        const liveText = newSegments
          .filter((s: TranscriptionSegment) => !s.isFinal)
          .map((s: TranscriptionSegment) => s.text)
          .join(' ');
        setCurrentText(liveText);
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    setIsCapturing(false);
    setCurrentText('');
    toast.success('Meeting audio capture stopped');
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
    ];
    return colors[speaker.length % colors.length];
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Monitor className="w-5 h-5" />
              <span>Meeting Audio Capture</span>
            </div>
            {isCapturing && (
              <Badge variant="default" className="bg-green-600">
                <Volume2 className="w-3 h-3 mr-1" />
                Capturing All Speakers
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={isCapturing ? stopCapture : startTabAudioCapture}
              size="lg"
              variant={isCapturing ? "destructive" : "default"}
              className="w-full"
            >
              {isCapturing ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Stop Audio Capture
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Capture Meeting Audio
                </>
              )}
            </Button>

            {!isCapturing && (
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p className="font-medium">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Click "Capture Meeting Audio"</li>
                  <li>Select "Share your screen" → "Chrome Tab"</li>
                  <li>Choose the tab with your meeting (Meet/Zoom/Teams)</li>
                  <li>✅ Check "Share tab audio" (CRITICAL)</li>
                  <li>Click "Share" to start capturing ALL participants</li>
                </ol>
              </div>
            )}

            {activeSpeakers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Speakers:</p>
                <div className="flex flex-wrap gap-2">
                  {activeSpeakers.map((speaker) => (
                    <Badge key={speaker} variant="outline" className={getSpeakerColor(speaker)}>
                      <Users className="w-3 h-3 mr-1" />
                      {speaker}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Transcription */}
      <Card className="h-96">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5" />
            <span>Live Multi-Speaker Transcription</span>
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
                <Monitor className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isCapturing ? 'Listening to meeting...' : 'Ready to capture meeting audio'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isCapturing
                    ? 'All meeting participants will appear here as they speak'
                    : 'Start capturing to transcribe ALL meeting participants in real-time'
                  }
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};