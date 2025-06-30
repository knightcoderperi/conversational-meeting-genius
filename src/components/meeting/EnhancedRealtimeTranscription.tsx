
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Mic, MicOff, Volume2, Settings, Users, Zap } from 'lucide-react';
import { IntegratedTranscriptionSystem, TranscriptionEntry } from '@/utils/integratedTranscriptionSystem';

interface EnhancedRealtimeTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  onTranscriptionUpdate: (segments: TranscriptionEntry[]) => void;
}

export const EnhancedRealtimeTranscription: React.FC<EnhancedRealtimeTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  onTranscriptionUpdate
}) => {
  const [transcriptionEntries, setTranscriptionEntries] = useState<TranscriptionEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micVolume, setMicVolume] = useState([1.0]);
  const [systemVolume, setSystemVolume] = useState([1.2]);
  const [speakingThreshold, setSpeakingThreshold] = useState([0.1]);
  const [systemStatus, setSystemStatus] = useState<{
    audioCapture: boolean;
    nameExtraction: boolean;
    speakerIdentification: boolean;
  }>({
    audioCapture: false,
    nameExtraction: false,
    speakerIdentification: false
  });

  const transcriptionSystemRef = useRef<IntegratedTranscriptionSystem | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeEnhancedTranscription();
    } else {
      cleanupTranscription();
    }

    return () => {
      cleanupTranscription();
    };
  }, [isRecording, mediaStream, meetingId]);

  const initializeEnhancedTranscription = async () => {
    try {
      console.log('🚀 Initializing enhanced transcription system...');
      
      // Create video element if we need to capture screen content
      if (!videoElementRef.current) {
        videoElementRef.current = document.createElement('video');
        videoElementRef.current.style.display = 'none';
        document.body.appendChild(videoElementRef.current);
        
        // Try to get screen capture for name extraction
        if (mediaStream) {
          const videoTracks = mediaStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const videoStream = new MediaStream([videoTracks[0]]);
            videoElementRef.current.srcObject = videoStream;
            videoElementRef.current.play();
          }
        }
      }

      // Initialize transcription system
      transcriptionSystemRef.current = new IntegratedTranscriptionSystem((entries) => {
        setTranscriptionEntries(entries);
        onTranscriptionUpdate(entries);
      });

      await transcriptionSystemRef.current.initialize(videoElementRef.current);
      
      // Update system status
      setSystemStatus({
        audioCapture: true,
        nameExtraction: true,
        speakerIdentification: true
      });

      await transcriptionSystemRef.current.startTranscription();
      setIsConnected(true);
      
      console.log('✅ Enhanced transcription system active!');

    } catch (error) {
      console.error('❌ Enhanced transcription initialization failed:', error);
      setSystemStatus({
        audioCapture: false,
        nameExtraction: false,
        speakerIdentification: false
      });
    }
  };

  const cleanupTranscription = () => {
    if (transcriptionSystemRef.current) {
      transcriptionSystemRef.current.cleanup();
      transcriptionSystemRef.current = null;
    }
    
    if (videoElementRef.current) {
      document.body.removeChild(videoElementRef.current);
      videoElementRef.current = null;
    }
    
    setIsConnected(false);
    setTranscriptionEntries([]);
    setSystemStatus({
      audioCapture: false,
      nameExtraction: false,
      speakerIdentification: false
    });
  };

  const handleVolumeChange = (type: 'mic' | 'system', value: number[]) => {
    if (transcriptionSystemRef.current) {
      if (type === 'mic') {
        setMicVolume(value);
        transcriptionSystemRef.current.adjustAudioLevels(value[0], systemVolume[0]);
      } else {
        setSystemVolume(value);
        transcriptionSystemRef.current.adjustAudioLevels(micVolume[0], value[0]);
      }
    }
  };

  const handleThresholdChange = (value: number[]) => {
    setSpeakingThreshold(value);
    if (transcriptionSystemRef.current) {
      transcriptionSystemRef.current.setSpeakingThreshold(value[0]);
    }
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = {
      'Speaker 1': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Speaker 2': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Speaker 3': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Speaker 4': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };
    
    // Generate color based on speaker name hash
    const hash = speaker.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colorIndex = Math.abs(hash) % 5;
    const colorOptions = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
    ];
    
    return colors[speaker as keyof typeof colors] || colorOptions[colorIndex];
  };

  const getStatusIcon = (status: boolean) => {
    return status ? '✅' : '❌';
  };

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <span>Enhanced Live Transcription</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            {isRecording && isConnected ? (
              <Badge variant="default" className="bg-green-600">
                <Volume2 className="w-3 h-3 mr-1" />
                Enhanced Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <MicOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </CardTitle>
        
        {/* System Status Indicators */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <span>{getStatusIcon(systemStatus.audioCapture)}</span>
            <span>Multi-Audio</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>{getStatusIcon(systemStatus.nameExtraction)}</span>
            <span>Name Extract</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>{getStatusIcon(systemStatus.speakerIdentification)}</span>
            <span>Speaker ID</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b bg-gray-50 dark:bg-gray-800 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Microphone Volume: {micVolume[0].toFixed(1)}</label>
              <Slider
                value={micVolume}
                onValueChange={(value) => handleVolumeChange('mic', value)}
                max={2}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">System Audio Volume: {systemVolume[0].toFixed(1)}</label>
              <Slider
                value={systemVolume}
                onValueChange={(value) => handleVolumeChange('system', value)}
                max={2}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Speaking Threshold: {speakingThreshold[0].toFixed(2)}</label>
              <Slider
                value={speakingThreshold}
                onValueChange={handleThresholdChange}
                max={0.5}
                min={0.01}
                step={0.01}
                className="w-full"
              />
            </div>
          </div>
        )}
        
        {/* Transcription Display */}
        <ScrollArea className="h-64 p-4">
          {transcriptionEntries.length > 0 ? (
            <div className="space-y-4">
              {transcriptionEntries.map((entry) => (
                <div key={entry.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getSpeakerColor(entry.speaker)}>
                      <Users className="w-3 h-3 mr-1" />
                      {entry.speaker}
                    </Badge>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{Math.round(entry.confidence * 100)}%</span>
                      {!entry.isFinal && <Badge variant="secondary" className="text-xs">Live</Badge>}
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    entry.isFinal 
                      ? 'text-gray-700 dark:text-gray-300' 
                      : 'text-gray-600 dark:text-gray-400 italic opacity-70'
                  }`}>
                    {entry.text}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-green-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${entry.audioLevel * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Zap className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording && isConnected ? 'Enhanced System Ready' : 'Enhanced Transcription Ready'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {isRecording && isConnected
                  ? 'Multi-speaker audio capture active • Video name extraction running • Real speaker identification enabled'
                  : 'Start recording to enable enhanced transcription features'
                }
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>🎤 Complete multi-speaker audio capture</div>
                <div>🎥 Video-based name extraction</div>
                <div>👤 Real speaker identification</div>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
