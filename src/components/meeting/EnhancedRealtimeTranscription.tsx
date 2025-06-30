
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Mic, MicOff, Volume2, Settings, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionEntry {
  id: string;
  timestamp: number;
  speaker: string;
  speakerId: string;
  text: string;
  confidence: number;
  audioLevel: number;
  isFinal: boolean;
}

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
  const [currentSpeaker, setCurrentSpeaker] = useState('Speaker 1');
  const [speakerCount, setSpeakerCount] = useState(1);
  const [currentInterimText, setCurrentInterimText] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastSpeechTime = useRef<number>(0);
  const silenceThreshold = 2000; // 2 seconds of silence to switch speakers

  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeTranscription();
    } else {
      cleanupTranscription();
    }

    return () => {
      cleanupTranscription();
    };
  }, [isRecording, mediaStream, meetingId]);

  const initializeTranscription = async () => {
    try {
      console.log('🚀 Initializing enhanced transcription...');
      
      // Setup audio analysis for speaker detection
      if (mediaStream) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        
        console.log('✅ Audio analysis setup complete');
      }

      // Setup speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognitionConstructor();
        
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 1;
        
        recognitionRef.current.onstart = () => {
          console.log('🎤 Speech recognition started');
          setIsConnected(true);
        };
        
        recognitionRef.current.onresult = (event) => {
          handleSpeechRecognitionResult(event);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('❌ Speech recognition error:', event.error);
          
          // Auto-restart on certain errors
          if (event.error === 'network' || event.error === 'no-speech') {
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 1000);
          }
        };
        
        recognitionRef.current.onend = () => {
          console.log('🔄 Speech recognition ended, restarting...');
          // Auto-restart if still recording
          if (isRecording && recognitionRef.current) {
            setTimeout(() => {
              recognitionRef.current!.start();
            }, 100);
          }
        };
        
        recognitionRef.current.start();
        console.log('✅ Speech recognition initialized');
        
      } else {
        console.error('❌ Speech recognition not supported');
        throw new Error('Speech recognition not supported in this browser');
      }

    } catch (error) {
      console.error('❌ Transcription initialization failed:', error);
      setIsConnected(false);
    }
  };

  const handleSpeechRecognitionResult = (event: SpeechRecognitionEvent) => {
    const currentTime = Date.now();
    const audioLevel = getAudioLevel();
    
    // Determine current speaker based on timing
    const timeSinceLastSpeech = currentTime - lastSpeechTime.current;
    if (timeSinceLastSpeech > silenceThreshold) {
      // Switch to next speaker after silence
      switchToNextSpeaker();
    }
    lastSpeechTime.current = currentTime;
    
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.85;
      
      if (result.isFinal) {
        finalTranscript += transcript;
        
        // Create final transcription entry
        const entry: TranscriptionEntry = {
          id: `${currentTime}_${i}`,
          timestamp: currentTime,
          speaker: currentSpeaker,
          speakerId: currentSpeaker.toLowerCase().replace(' ', '_'),
          text: transcript.trim(),
          confidence: confidence,
          audioLevel: audioLevel,
          isFinal: true
        };
        
        if (transcript.trim()) {
          addTranscriptionEntry(entry);
          console.log(`💬 ${currentSpeaker}: ${transcript.trim()}`);
        }
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Update interim text display
    setCurrentInterimText(interimTranscript);
  };

  const getAudioLevel = (): number => {
    if (!analyserRef.current) return 0;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255;
  };

  const switchToNextSpeaker = () => {
    const nextSpeakerNumber = (parseInt(currentSpeaker.split(' ')[1]) % 4) + 1;
    const nextSpeaker = `Speaker ${nextSpeakerNumber}`;
    setCurrentSpeaker(nextSpeaker);
    setSpeakerCount(Math.max(speakerCount, nextSpeakerNumber));
    console.log(`🔄 Switched to ${nextSpeaker}`);
  };

  const addTranscriptionEntry = (entry: TranscriptionEntry) => {
    setTranscriptionEntries(prev => {
      const updated = [...prev, entry];
      onTranscriptionUpdate(updated);
      
      // Save to database
      if (meetingId) {
        saveTranscriptionEntry(entry);
      }
      
      return updated;
    });
  };

  const saveTranscriptionEntry = async (entry: TranscriptionEntry) => {
    try {
      await supabase
        .from('transcription_segments')
        .insert({
          meeting_id: meetingId,
          speaker_name: entry.speaker,
          speaker_id: entry.speakerId,
          text: entry.text,
          start_time: entry.timestamp / 1000,
          end_time: (entry.timestamp / 1000) + 3,
          confidence: entry.confidence,
          is_final: entry.isFinal
        });
    } catch (error) {
      console.error('Error saving transcription:', error);
    }
  };

  const cleanupTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setCurrentInterimText('');
    console.log('🧹 Transcription cleaned up');
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

  const forceSpeakerSwitch = () => {
    switchToNextSpeaker();
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
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <MicOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </CardTitle>
        
        {/* Current Speaker & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={getSpeakerColor(currentSpeaker)}>
              <Users className="w-3 h-3 mr-1" />
              Current: {currentSpeaker}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={forceSpeakerSwitch}
              disabled={!isRecording}
            >
              Switch Speaker
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            {speakerCount} speakers identified
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b bg-gray-50 dark:bg-gray-800 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p>• Automatic speaker detection based on speech patterns</p>
              <p>• Use "Switch Speaker" button to manually change speakers</p>
              <p>• System detects new speakers after 2 seconds of silence</p>
            </div>
          </div>
        )}
        
        {/* Transcription Display */}
        <ScrollArea className="h-64 p-4">
          {transcriptionEntries.length > 0 || currentInterimText ? (
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
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
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
              
              {/* Live interim text */}
              {currentInterimText && (
                <div className="space-y-2 opacity-70">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                      <Users className="w-3 h-3 mr-1" />
                      {currentSpeaker} (Live)
                    </Badge>
                    <span className="text-xs text-gray-500">Speaking...</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    {currentInterimText}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Zap className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording && isConnected ? 'Listening for Speech...' : 'Ready to Transcribe'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {isRecording && isConnected
                  ? 'Start speaking to see live transcription with automatic speaker detection'
                  : 'Click record to begin enhanced transcription'
                }
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>🎤 Real-time speech recognition</div>
                <div>👤 Automatic speaker switching</div>
                <div>💬 Live transcript display</div>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
