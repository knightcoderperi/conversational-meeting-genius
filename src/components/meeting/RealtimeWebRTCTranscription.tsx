import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Users, Activity } from 'lucide-react';
import { transcriptionAPI } from '@/utils/apiConfiguration';

interface Participant {
  id: string;
  name: string;
  audioStream: MediaStream | null;
  audioLevel: number;
  isActive: boolean;
}

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  confidence: number;
}

export const RealtimeWebRTCTranscription: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorders = useRef<Map<string, MediaRecorder>>(new Map());
  const audioContext = useRef<AudioContext | null>(null);
  const analysers = useRef<Map<string, AnalyserNode>>(new Map());

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting WebRTC voice transcription...');
      
      // Initialize audio context
      audioContext.current = new AudioContext();
      
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      setLocalStream(stream);
      
      // Add local participant
      const localParticipant: Participant = {
        id: 'local',
        name: 'You',
        audioStream: stream,
        audioLevel: 0,
        isActive: false
      };
      
      setParticipants([localParticipant]);
      
      // Set up audio analysis for local stream
      setupAudioAnalysis('local', stream);
      
      // Start recording local stream
      startStreamRecording('local', stream, 'You');
      
      setIsRecording(true);
      
      console.log('✅ WebRTC transcription started');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  };

  const setupAudioAnalysis = (participantId: string, stream: MediaStream) => {
    if (!audioContext.current) return;
    
    const source = audioContext.current.createMediaStreamSource(stream);
    const analyser = audioContext.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    // NO AUDIO OUTPUT - Only analysis, prevent echo
    source.connect(analyser);
    // Do NOT connect to destination to prevent echo
    analysers.current.set(participantId, analyser);
    
    // Monitor audio levels
    const monitorAudioLevel = () => {
      if (!isRecording) return;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const level = average / 255;
      
      setParticipants(prev => prev.map(p => 
        p.id === participantId 
          ? { ...p, audioLevel: level, isActive: level > 0.1 }
          : p
      ));
      
      requestAnimationFrame(monitorAudioLevel);
    };
    
    monitorAudioLevel();
  };

  const startStreamRecording = (participantId: string, stream: MediaStream, speakerName: string) => {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    const audioChunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        
        // Process audio chunk for transcription
        processAudioChunk(event.data, speakerName);
      }
    };
    
    mediaRecorder.onstop = () => {
      console.log(`📝 Recording stopped for ${speakerName}`);
    };
    
    mediaRecorders.current.set(participantId, mediaRecorder);
    
    // Start recording with 3-second intervals
    mediaRecorder.start(3000);
    
    console.log(`🎙️ Started recording for ${speakerName}`);
  };

  const processAudioChunk = async (audioBlob: Blob, speakerName: string) => {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));
      
      // Send to AssemblyAI for transcription
      const result = await transcriptionAPI.transcribeAudio(base64Audio);
      
      if (result.text && result.text.trim()) {
        const transcription: TranscriptionSegment = {
          id: `${Date.now()}-${Math.random()}`,
          speaker: speakerName,
          text: result.text,
          timestamp: new Date(),
          confidence: result.confidence || 0.85
        };
        
        setTranscriptions(prev => {
          const updated = [...prev, transcription];
          console.log(`💬 LIVE TRANSCRIPTION: ${speakerName}: ${result.text}`);
          return updated;
        });
      }
      
    } catch (error) {
      console.error('❌ Transcription error:', error);
    }
  };

  const addParticipant = async (name: string) => {
    try {
      // Simulate adding a remote participant (in real implementation, this would come from WebRTC signaling)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      const participantId = `participant-${Date.now()}`;
      const newParticipant: Participant = {
        id: participantId,
        name,
        audioStream: stream,
        audioLevel: 0,
        isActive: false
      };
      
      setParticipants(prev => [...prev, newParticipant]);
      setupAudioAnalysis(participantId, stream);
      startStreamRecording(participantId, stream, name);
      
      console.log(`👤 Added participant: ${name}`);
      
    } catch (error) {
      console.error('❌ Failed to add participant:', error);
    }
  };

  const stopRecording = () => {
    console.log('🛑 Stopping WebRTC transcription...');
    
    // Stop all media recorders
    mediaRecorders.current.forEach(recorder => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    });
    
    // Stop all audio streams
    participants.forEach(participant => {
      if (participant.audioStream) {
        participant.audioStream.getTracks().forEach(track => track.stop());
      }
    });
    
    // Close audio context
    if (audioContext.current) {
      audioContext.current.close();
    }
    
    // Clean up
    peerConnections.current.clear();
    mediaRecorders.current.clear();
    analysers.current.clear();
    
    setIsRecording(false);
    setLocalStream(null);
    setParticipants([]);
    
    console.log('✅ WebRTC transcription stopped');
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Real-time WebRTC Transcription
          </h2>
          <div className="flex gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} className="gap-2">
                <Mic className="w-4 h-4" />
                Start Recording
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <MicOff className="w-4 h-4" />
                Stop Recording
              </Button>
            )}
          </div>
        </div>

        {/* Participants Panel */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Participants ({participants.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {participants.map(participant => (
              <div 
                key={participant.id}
                className={`p-3 rounded-lg border ${
                  participant.isActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{participant.name}</span>
                  <div className="flex items-center gap-2">
                    {participant.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Speaking
                      </Badge>
                    )}
                    <div className="w-8 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${participant.audioLevel * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {isRecording && (
            <Button 
              onClick={() => addParticipant(`Speaker ${participants.length + 1}`)}
              variant="outline"
              className="mt-3"
            >
              Add Test Participant
            </Button>
          )}
        </div>

        {/* Live Transcription */}
        <div>
          <h3 className="text-lg font-medium mb-3">Live Transcription</h3>
          <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/20">
            {transcriptions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isRecording ? 'Listening for speech...' : 'Start recording to see transcriptions'}
              </div>
            ) : (
              transcriptions.map(transcription => (
                <div key={transcription.id} className="flex gap-3">
                  <span className="text-xs text-muted-foreground min-w-[60px]">
                    {formatTimestamp(transcription.timestamp)}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-primary">
                      {transcription.speaker}:
                    </span>
                    <span className="ml-2">{transcription.text}</span>
                    <Badge 
                      variant="outline" 
                      className="ml-2 text-xs"
                    >
                      {Math.round(transcription.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};