
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, Video, Settings, Zap, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingControlCenterProps {
  onStartRecording: (stream: MediaStream) => void;
  onStopRecording: () => void;
  meetingId: string | null;
  isRecording: boolean;
}

export const MeetingControlCenter: React.FC<MeetingControlCenterProps> = ({
  onStartRecording,
  onStopRecording,
  meetingId,
  isRecording
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
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
    setIsInitializing(true);
    try {
      toast.info('🚀 Initializing unlimited recording system...');
      
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...audioStream.getAudioTracks()
      ]);

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      
      toast.success('🎯 Unlimited recording started! No time limits.', {
        description: 'Advanced AI transcription and analysis active'
      });

      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast.error('🔒 Permission denied. Please allow screen sharing and microphone access.');
      } else {
        toast.error('❌ Failed to start recording. Please check permissions and try again.');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    onStopRecording();
    toast.success('✅ Recording completed and saved successfully!');
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
    <Card className="w-full bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-0 shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              {isRecording && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                Meeting Control Center
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Unlimited Recording • AI-Powered Transcription
              </p>
            </div>
          </div>
          {isRecording && (
            <Badge className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-0 animate-pulse shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
              LIVE UNLIMITED
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center">
          <Button
            onClick={isRecording ? stopRecording : startScreenRecording}
            size="lg"
            disabled={isInitializing}
            className={`w-full h-14 text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-xl ${
              isRecording 
                ? "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700" 
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            } text-white border-0`}
          >
            {isInitializing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                Initializing...
              </>
            ) : isRecording ? (
              <>
                <Square className="w-6 h-6 mr-3" />
                Stop Recording
              </>
            ) : (
              <>
                <Play className="w-6 h-6 mr-3" />
                Start Unlimited Recording
              </>
            )}
          </Button>
        </div>

        {isRecording && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="text-4xl font-mono font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {formatTime(recordingTime)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                🚀 Unlimited Recording Duration
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse mb-1"></div>
                <span className="text-xs font-medium text-green-700 dark:text-green-400">Screen Active</span>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto animate-pulse mb-1"></div>
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Audio Live</span>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto animate-pulse mb-1"></div>
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400">AI Active</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  Recording Status
                </h4>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Unlimited Duration
                </Badge>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between">
                  <span>📹 Screen + Audio Recording</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>🧠 AI Transcription</span>
                  <span className="text-blue-600 font-medium">Processing</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>💾 Auto-Save</span>
                  <span className="text-purple-600 font-medium">Enabled</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isRecording && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  🚀 Unlimited Recording Features
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>No time limits</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                  <Users className="w-4 h-4 text-green-500" />
                  <span>Smart speaker detection</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                  <Mic className="w-4 h-4 text-purple-500" />
                  <span>Real-time transcription</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span>AI-powered insights</span>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>✨ Click to start unlimited duration recording</div>
              <div>🎯 Advanced AI will analyze everything in real-time</div>
              <div>🚀 No duration limits • Crystal clear quality</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
