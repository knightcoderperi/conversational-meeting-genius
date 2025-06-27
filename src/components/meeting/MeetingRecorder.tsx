
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, Video, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingRecorderProps {
  onStartRecording: (stream: MediaStream) => void;
  onStopRecording: () => void;
  meetingId: string | null;
  isRecording: boolean;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onStartRecording,
  onStopRecording,
  meetingId,
  isRecording
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const startScreenRecording = async () => {
    try {
      // Request screen capture - removed invalid mediaSource property
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Request microphone
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Combine streams
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...audioStream.getAudioTracks()
      ]);

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      toast.success('Recording started successfully!');

      // Handle stream end (user clicks stop sharing)
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    onStopRecording();
    toast.success('Recording stopped');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Video className="w-5 h-5" />
          <span>Recording Controls</span>
          {isRecording && (
            <Badge variant="destructive" className="ml-auto">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
              LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <Button
            onClick={isRecording ? stopRecording : startScreenRecording}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="w-full"
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start Recording
              </>
            )}
          </Button>
        </div>

        {isRecording && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                {formatTime(recordingTime)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Recording duration</p>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Screen</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Audio</span>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                Recording screen and audio. Stop browser screen sharing to end recording.
              </p>
            </div>
          </div>
        )}

        {!isRecording && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
              <Settings className="w-4 h-4" />
              <span>Click to start recording your screen and audio</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              • Screen sharing permission required
              <br />
              • Microphone access needed for transcription
              <br />
              • Recording will include system audio
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
