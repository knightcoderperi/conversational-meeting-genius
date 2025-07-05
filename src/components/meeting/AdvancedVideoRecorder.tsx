import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Video, Users, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SpeakerInfo {
  id: string;
  name: string;
  confidence: number;
  lastSeen: number;
}

interface AdvancedVideoRecorderProps {
  onStartRecording: (stream: MediaStream) => void;
  onStopRecording: () => void;
  onSpeakerDetected: (speaker: SpeakerInfo) => void;
  meetingId: string | null;
  isRecording: boolean;
}

export const AdvancedVideoRecorder: React.FC<AdvancedVideoRecorderProps> = ({
  onStartRecording,
  onStopRecording,
  onSpeakerDetected,
  meetingId,
  isRecording
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<SpeakerInfo[]>([]);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startAdvancedRecording = async () => {
    try {
      // Get screen share with audio
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

      // Get user camera for speaker identification
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Combine all streams
      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...cameraStream.getAudioTracks()
      ]);

      // Set up video preview for speaker detection
      setVideoStream(cameraStream);
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }

      // Start MediaRecorder for video/audio recording
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        await saveRecording(blob);
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;

      setMediaStream(combinedStream);
      onStartRecording(combinedStream);
      
      // Start speaker detection analysis
      startSpeakerAnalysis();
      
      toast.success('Advanced recording started with speaker detection!');

      // Handle stream end
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopAdvancedRecording();
      });

    } catch (error) {
      console.error('Error starting advanced recording:', error);
      toast.error('Failed to start recording. Please check permissions.');
    }
  };

  const startSpeakerAnalysis = () => {
    if (!videoRef.current || !canvasRef.current) return;

    analysisIntervalRef.current = setInterval(async () => {
      await analyzeSpeaker();
    }, 2000); // Analyze every 2 seconds
  };

  const analyzeSpeaker = async () => {
    if (!videoRef.current || !canvasRef.current || !isRecording) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Capture current frame
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      // Convert to blob for processing
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          // Send to speaker identification service
          const { data, error } = await supabase.functions.invoke('identify-speaker', {
            body: { 
              imageBlob: Array.from(new Uint8Array(await blob.arrayBuffer())),
              meetingId: meetingId 
            }
          });

          if (!error && data && data.speaker) {
            const speakerInfo: SpeakerInfo = {
              id: data.speaker.id || 'unknown',
              name: data.speaker.name || `Speaker ${activeSpeakers.length + 1}`,
              confidence: data.speaker.confidence || 0.8,
              lastSeen: Date.now()
            };

            // Update active speakers
            setActiveSpeakers(prev => {
              const existing = prev.find(s => s.id === speakerInfo.id);
              if (existing) {
                return prev.map(s => s.id === speakerInfo.id ? speakerInfo : s);
              }
              return [...prev, speakerInfo];
            });

            onSpeakerDetected(speakerInfo);
          }
        } catch (error) {
          console.error('Speaker identification error:', error);
          // Fallback to generic speaker naming
          const fallbackSpeaker: SpeakerInfo = {
            id: `speaker_${Date.now()}`,
            name: `Speaker ${activeSpeakers.length + 1}`,
            confidence: 0.7,
            lastSeen: Date.now()
          };
          onSpeakerDetected(fallbackSpeaker);
        }
      }, 'image/jpeg', 0.8);

    } catch (error) {
      console.error('Frame analysis error:', error);
    }
  };

  const saveRecording = async (blob: Blob) => {
    if (!meetingId) return;

    try {
      const fileName = `recording_${meetingId}_${Date.now()}.webm`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(fileName, blob);

      if (error) {
        console.error('Upload error:', error);
        return;
      }

      // Update meeting record with recording URL
      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      await supabase
        .from('meetings')
        .update({ 
          recording_url: urlData.publicUrl,
          video_url: urlData.publicUrl 
        })
        .eq('id', meetingId);

      toast.success('Recording saved successfully!');
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('Failed to save recording');
    }
  };

  const stopAdvancedRecording = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all streams
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }

    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    onStopRecording();
    toast.success('Recording stopped and saved');
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
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Video className="w-5 h-5" />
            <span>Advanced Recording</span>
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
              onClick={isRecording ? stopAdvancedRecording : startAdvancedRecording}
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
                  Start Advanced Recording
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

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Screen + Audio</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Speaker Detection</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Speakers */}
      {activeSpeakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Active Speakers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {activeSpeakers.map((speaker) => (
                <div key={speaker.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{speaker.name}</p>
                    <p className="text-xs text-gray-500">{Math.round(speaker.confidence * 100)}% confidence</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden video and canvas elements for processing */}
      <div className="hidden">
        <video ref={videoRef} autoPlay muted />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};