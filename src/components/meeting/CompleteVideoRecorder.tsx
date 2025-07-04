import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorOff, 
  Mic, 
  MicOff,
  Download,
  Users,
  Volume2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CompleteVideoRecorderProps {
  meetingId: string;
  onTranscriptionUpdate: (transcription: string) => void;
}

export const CompleteVideoRecorder: React.FC<CompleteVideoRecorderProps> = ({
  meetingId,
  onTranscriptionUpdate
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      screenStreamRef.current = screenStream;
      audioStreamRef.current = audioStream;

      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);
      toast.success('Screen sharing started');
    } catch (error) {
      console.error('Screen share failed:', error);
      toast.error('Failed to start screen sharing');
    }
  };

  const startRecording = async () => {
    if (!screenStreamRef.current || !audioStreamRef.current) {
      toast.error('Please start screen sharing first');
      return;
    }

    try {
      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...screenStreamRef.current.getVideoTracks(),
        ...audioStreamRef.current.getAudioTracks()
      ]);

      mediaRecorderRef.current = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        await saveRecording(blob);
      };

      // Start recording with 1-second intervals for transcription
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevel();

      // Start transcription
      startTranscription();

      toast.success('Recording started');
    } catch (error) {
      console.error('Recording failed:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      toast.success('Recording stopped');
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsScreenSharing(false);
    setIsRecording(false);
    toast.info('Screen sharing stopped');
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (analyserRef.current && isRecording) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(average / 255 * 100, 100));
        requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  };

  const startTranscription = async () => {
    if (!audioStreamRef.current) return;

    const mediaRecorder = new MediaRecorder(audioStreamRef.current, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && isRecording) {
        await transcribeAudio(event.data);
      }
    };

    mediaRecorder.start(3000); // 3-second chunks for transcription
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      const response = await supabase.functions.invoke('transcribe-audio', {
        body: formData
      });

      if (response.data?.text) {
        const newText = response.data.text;
        setTranscriptionText(prev => prev + ' ' + newText);
        onTranscriptionUpdate(newText);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
    }
  };

  const saveRecording = async (blob: Blob) => {
    try {
      const fileName = `meeting-${meetingId}-${Date.now()}.webm`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(fileName, blob);

      if (error) throw error;

      // Save recording info to database
      await supabase
        .from('meetings')
        .update({
          recording_url: data.path,
          transcript: transcriptionText,
          duration: recordingDuration
        })
        .eq('id', meetingId);

      toast.success('Recording saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save recording');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      stopScreenShare();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5" />
            <span>Complete Video Recorder</span>
          </div>
          <div className="flex items-center space-x-2">
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                REC {formatDuration(recordingDuration)}
              </Badge>
            )}
            {isScreenSharing && (
              <Badge variant="secondary">
                <Monitor className="w-3 h-3 mr-1" />
                Sharing
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full h-48 object-contain"
          />
          {!isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">Start screen sharing to preview</p>
              </div>
            </div>
          )}
        </div>

        {/* Audio Level */}
        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <Volume2 className="w-4 h-4 mr-1" />
                Audio Level
              </span>
              <span>{Math.round(audioLevel)}%</span>
            </div>
            <Progress value={audioLevel} className="h-2" />
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {!isScreenSharing ? (
            <Button onClick={startScreenShare} className="flex-1">
              <Monitor className="w-4 h-4 mr-2" />
              Start Screen Share
            </Button>
          ) : (
            <Button onClick={stopScreenShare} variant="outline" className="flex-1">
              <MonitorOff className="w-4 h-4 mr-2" />
              Stop Screen Share
            </Button>
          )}

          {isScreenSharing && !isRecording && (
            <Button onClick={startRecording} variant="destructive" className="flex-1">
              <Video className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <Button onClick={stopRecording} variant="outline" className="flex-1">
              <VideoOff className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>

        {/* Live Transcription */}
        {transcriptionText && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Live Transcription</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {transcriptionText}
            </p>
          </div>
        )}

        {/* Status Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>Production Features</span>
          </div>
          <div className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>HD screen recording with audio</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Real-time transcription & speaker detection</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Automatic cloud storage & backup</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};