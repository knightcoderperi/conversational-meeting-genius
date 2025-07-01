
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, Video, Settings, Zap, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { MultiSpeakerAudioCapture } from '@/utils/multiSpeakerAudioCapture';

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
  const [audioCapture, setAudioCapture] = useState<MultiSpeakerAudioCapture | null>(null);
  const [audioLevels, setAudioLevels] = useState({ microphone: 0, system: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start monitoring audio levels
      audioLevelIntervalRef.current = setInterval(() => {
        if (audioCapture) {
          const level = audioCapture.getAudioLevel();
          setAudioLevels(prev => ({
            ...prev,
            system: level
          }));
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      setRecordingTime(0);
      setAudioLevels({ microphone: 0, system: 0 });
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    };
  }, [isRecording, audioCapture]);

  const startCompleteAudioRecording = async () => {
    try {
      console.log('🚀 Starting complete multi-speaker audio recording...');
      
      // Initialize multi-speaker audio capture
      const capture = new MultiSpeakerAudioCapture();
      const completeAudioStream = await capture.setupCompleteAudioCapture();
      
      // Request screen capture for video
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // We'll use our custom audio capture instead
      });

      // Combine video with our complete audio capture
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...completeAudioStream.getAudioTracks()
      ]);

      setAudioCapture(capture);
      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      
      toast.success('🎯 Complete multi-speaker recording started! All participants\' audio will be captured.');

      // Handle stream end
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });

    } catch (error) {
      console.error('Complete audio recording failed:', error);
      toast.error('Complete recording failed. Falling back to standard recording...');
      
      // Fallback to standard recording
      try {
        await startStandardRecording();
      } catch (fallbackError) {
        toast.error('Recording failed. Please check permissions and ensure you\'re in a meeting.');
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
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
          channelCount: 2,
          autoGainControl: false
        }
      });

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...audioStream.getAudioTracks()
      ]);

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      toast.success('Standard recording started (partial audio capture)');

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
    
    if (audioCapture) {
      audioCapture.cleanup();
      setAudioCapture(null);
    }
    
    onStopRecording();
    toast.success('Recording stopped');
  };

  const adjustMicrophoneVolume = (volume: number) => {
    if (audioCapture) {
      audioCapture.adjustGain('microphone', volume);
      toast.success(`Microphone volume: ${Math.round(volume * 100)}%`);
    }
  };

  const adjustSystemVolume = (volume: number) => {
    if (audioCapture) {
      audioCapture.adjustGain('system', volume);
      toast.success(`System audio volume: ${Math.round(volume * 100)}%`);
    }
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
          <span>Complete Multi-Speaker Recording</span>
          {isRecording && (
            <Badge variant="destructive" className="ml-auto">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
              ALL SPEAKERS LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <Button
            onClick={isRecording ? stopRecording : startCompleteAudioRecording}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="w-full"
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5 mr-2" />
                Stop Complete Recording
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Start Complete Multi-Speaker Recording
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
              <p className="text-sm text-gray-600 dark:text-gray-300">Complete recording duration</p>
            </div>

            {/* Audio Level Indicators */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Your Microphone</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${audioLevels.microphone * 100}%` }}
                    ></div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => adjustMicrophoneVolume(1.2)}
                    className="text-xs px-2 py-1"
                  >
                    Boost
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Remote Speakers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${audioLevels.system * 100}%` }}
                    ></div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => adjustSystemVolume(1.5)}
                    className="text-xs px-2 py-1"
                  >
                    Boost
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Complete Audio Capture</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">All Participants</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Local Microphone</span>
              </div>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">System Audio</span>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-300 text-center font-medium">
                ✅ Complete Multi-Speaker Recording Active: Capturing ALL participants' audio with enhanced quality
              </p>
            </div>
          </div>
        )}

        {!isRecording && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                <Zap className="w-4 h-4" />
                <span>Complete Multi-Speaker Recording</span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <div>🎤 Your microphone with noise suppression</div>
                <div>🔊 Complete system audio capture (all remote speakers)</div>
                <div>👥 Every participant's voice recorded clearly</div>
                <div>⚡ Real-time audio level monitoring</div>
                <div>🎚️ Individual volume controls</div>
                <div>🎯 Enhanced audio quality for all speakers</div>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              • Screen sharing permission required for video
              <br />
              • Microphone access needed for your voice
              <br />
              • System audio capture for ALL remote participants
              <br />
              • Audio levels will be monitored and adjustable during recording
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                💡 This recording method captures COMPLETE audio from all meeting participants, not just the recording creator
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
