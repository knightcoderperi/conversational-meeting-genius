
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, Video, Settings, Zap } from 'lucide-react';
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
  const [enhancedMode, setEnhancedMode] = useState(true);
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

  const startEnhancedRecording = async () => {
    try {
      console.log('🚀 Starting enhanced screen recording...');
      
      // Request screen capture with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
          channelCount: 2,
          autoGainControl: false
        }
      });

      // Request high-quality microphone
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          sampleSize: 16
        }
      });

      // Combine all streams for enhanced capture
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...audioStream.getAudioTracks()
      ]);

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      toast.success('Enhanced recording started! 🎯 Multi-speaker audio + video name extraction active');

      // Handle stream end
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });

    } catch (error) {
      console.error('Enhanced recording failed:', error);
      toast.error('Enhanced recording failed. Falling back to standard recording...');
      
      // Fallback to standard recording
      try {
        await startStandardRecording();
      } catch (fallbackError) {
        toast.error('Recording failed. Please check permissions.');
      }
    }
  };

  const startStandardRecording = async () => {
    try {
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

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...audioStream.getAudioTracks()
      ]);

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      toast.success('Standard recording started');

      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });

    } catch (error) {
      console.error('Standard recording failed:', error);
      throw error;
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
          <span>Enhanced Recording Controls</span>
          {isRecording && (
            <Badge variant="destructive" className="ml-auto">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
              ENHANCED LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <Button
            onClick={isRecording ? stopRecording : (enhancedMode ? startEnhancedRecording : startStandardRecording)}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="w-full"
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 mr-2" />
                Stop Enhanced Recording
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Start Enhanced Recording
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
              <p className="text-sm text-gray-600 dark:text-gray-300">Enhanced recording duration</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Multi-Speaker Audio</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Video Analysis</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">High-Quality Mic</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Real Speaker ID</span>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-300 text-center font-medium">
                ✅ Enhanced Features Active: Multi-speaker audio capture, video name extraction, and real speaker identification
              </p>
            </div>
          </div>
        )}

        {!isRecording && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                <Zap className="w-4 h-4" />
                <span>Enhanced Recording Features</span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <div>🎤 Complete multi-speaker audio capture</div>
                <div>🎥 Video-based participant name extraction</div>
                <div>👤 Real-time speaker identification</div>
                <div>⚡ Unlimited recording duration</div>
                <div>🔊 Audio quality enhancement</div>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              • Screen sharing permission required
              <br />
              • Microphone access needed for enhanced features
              <br />
              • System audio will be captured for remote speakers
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
