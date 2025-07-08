import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Users, Volume2 } from 'lucide-react';
import { transcriptionAPI } from '@/utils/apiConfiguration';
import { toast } from 'sonner';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface EnhancedLiveTranscriptionProps {
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const EnhancedLiveTranscription: React.FC<EnhancedLiveTranscriptionProps> = ({
  onTranscriptionUpdate
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('Speaker 1');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting enhanced live transcription...');
      
      // Get microphone access with echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      audioStreamRef.current = stream;
      
      // Set up audio analysis (NO OUTPUT to prevent echo)
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Connect source to analyser ONLY (no destination = no echo)
      source.connect(analyserRef.current);
      
      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await processAudioChunk(event.data);
        }
      };
      
      // Start recording with 3-second chunks
      mediaRecorderRef.current.start(3000);
      setIsRecording(true);
      
      toast.success('Live transcription started');
      console.log('✅ Enhanced transcription active');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast.error('Failed to start transcription');
    }
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));
      
      // Send to AssemblyAI
      const result = await transcriptionAPI.transcribeAudio(base64Audio);
      
      if (result.text && result.text.trim()) {
        const newTranscription: TranscriptionSegment = {
          id: `${Date.now()}-${Math.random()}`,
          speaker: currentSpeaker,
          text: result.text.trim(),
          confidence: result.confidence || 0.85,
          timestamp: new Date().toLocaleTimeString(),
          isFinal: true
        };
        
        setTranscriptions(prev => {
          const updated = [...prev, newTranscription];
          
          // Update parent component with transcription data
          onTranscriptionUpdate(updated);
          
          console.log(`💬 LIVE: ${currentSpeaker}: ${result.text}`);
          return updated;
        });
      }
      
    } catch (error) {
      console.error('❌ Transcription processing error:', error);
    }
  };

  const stopRecording = () => {
    console.log('🛑 Stopping enhanced transcription...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    toast.info('Live transcription stopped');
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return timestamp;
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>Enhanced Live Transcription</span>
          </div>
          <div className="flex items-center space-x-2">
            {!isRecording ? (
              <Button onClick={startRecording} size="sm" className="gap-2">
                <Mic className="w-4 h-4" />
                Start Live
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-2">
                <MicOff className="w-4 h-4" />
                Stop
              </Button>
            )}
            {isRecording && (
              <Badge variant="default" className="bg-green-600">
                <Volume2 className="w-3 h-3 mr-1" />
                Live
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-80 p-4">
          {transcriptions.length > 0 ? (
            <div className="space-y-4">
              {transcriptions.map((transcription) => (
                <div key={transcription.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getSpeakerColor(transcription.speaker)}>
                      {transcription.speaker}
                    </Badge>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{transcription.timestamp}</span>
                      <span>•</span>
                      <span>{Math.round(transcription.confidence * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {transcription.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording ? 'Listening for speech...' : 'Ready for live transcription'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isRecording
                  ? 'Speak to see real-time transcription with AssemblyAI'
                  : 'Click Start Live to begin real-time transcription'
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};