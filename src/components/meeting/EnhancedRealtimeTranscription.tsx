
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, User, Download, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { AudioProcessor, SpeakerIdentifier } from '@/utils/audioProcessor';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface EnhancedRealtimeTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const EnhancedRealtimeTranscription: React.FC<EnhancedRealtimeTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  onTranscriptionUpdate
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [speakerName, setSpeakerName] = useState('Main Speaker');
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const speakerIdentifierRef = useRef<SpeakerIdentifier | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeTranscription();
      startDurationTimer();
    } else {
      cleanupTranscription();
    }

    return () => {
      cleanupTranscription();
    };
  }, [isRecording, mediaStream, meetingId]);

  const startDurationTimer = () => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  };

  const initializeTranscription = async () => {
    try {
      console.log('🎤 Initializing enhanced real-time transcription...');
      
      speakerIdentifierRef.current = new SpeakerIdentifier();
      if (speakerName !== 'Main Speaker') {
        speakerIdentifierRef.current.setSpeakerName(speakerName);
      }
      
      audioProcessorRef.current = new AudioProcessor((audioData) => {
        if (speakerIdentifierRef.current) {
          speakerIdentifierRef.current.identifySpeaker(audioData);
        }
      });

      if (mediaStream) {
        await audioProcessorRef.current.startProcessing(mediaStream);
      }

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 3;
        
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
              
              const currentSpeaker = speakerIdentifierRef.current?.getCurrentSpeaker() || speakerName;
              
              const segment: TranscriptionSegment = {
                id: Date.now().toString() + Math.random(),
                speaker: currentSpeaker,
                text: transcript.trim(),
                confidence: confidence || 0.85,
                timestamp: new Date().toLocaleTimeString(),
                isFinal: true
              };
              
              setSegments(prev => {
                const updated = [...prev, segment];
                onTranscriptionUpdate(updated);
                return updated;
              });

              setWordCount(prev => prev + transcript.trim().split(' ').length);

              if (meetingId) {
                saveTranscriptionSegment(meetingId, segment);
              }
            } else {
              interimTranscript += transcript;
            }
          }
          
          setCurrentText(interimTranscript);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Speech recognition warning:', event.error);
          if (event.error === 'network') {
            setTimeout(() => {
              if (recognitionRef.current && isRecording) {
                recognitionRef.current.start();
              }
            }, 1000);
          }
        };

        recognitionRef.current.onend = () => {
          if (isRecording) {
            setTimeout(() => {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 100);
          }
        };

        recognitionRef.current.start();
        setIsConnected(true);
        
        console.log('🎯 Enhanced speech recognition started');
      }

    } catch (error) {
      console.error('Error initializing transcription:', error);
    }
  };

  const saveTranscriptionSegment = async (meetingId: string, segment: TranscriptionSegment) => {
    try {
      await supabase
        .from('transcription_segments')
        .insert({
          meeting_id: meetingId,
          speaker_name: segment.speaker,
          speaker_id: segment.speaker.toLowerCase().replace(/\s+/g, '_'),
          text: segment.text,
          start_time: Date.now() / 1000,
          end_time: Date.now() / 1000 + 3,
          confidence: segment.confidence,
          is_final: segment.isFinal
        });
    } catch (error) {
      console.error('Error saving transcription segment:', error);
    }
  };

  const cleanupTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
      audioProcessorRef.current = null;
    }
    setIsConnected(false);
    setCurrentText('');
  };

  const exportTranscription = () => {
    const content = segments
      .map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSegments = segments.filter(segment =>
    segment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-96 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-2xl backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              {isRecording && isConnected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Live Transcription
              </span>
              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                <span>⏱️ {formatDuration(duration)}</span>
                <span>📝 {wordCount} words</span>
                <span>🎯 {segments.length} segments</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isRecording && isConnected ? (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 animate-pulse">
                <Volume2 className="w-3 h-3 mr-1" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="secondary" className="border-dashed">
                <MicOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col h-full">
        <div className="px-4 pb-3 space-y-3">
          <div className="flex space-x-2">
            <Input
              placeholder="🔍 Search transcription..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            />
            <Button
              onClick={exportTranscription}
              size="sm"
              variant="outline"
              disabled={segments.length === 0}
              className="hover:bg-blue-50 hover:border-blue-200"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {filteredSegments.length > 0 || currentText ? (
            <div className="space-y-4 pb-4">
              {filteredSegments.map((segment) => (
                <div key={segment.id} className="group animate-fade-in">
                  <div className="flex items-start space-x-3 p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                          {segment.speaker}
                        </Badge>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="font-mono">{segment.timestamp}</span>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>{Math.round(segment.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {currentText && (
                <div className="group animate-pulse">
                  <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                      <Mic className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0">
                          🎤 Speaking...
                        </Badge>
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 animate-pulse">Live</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                        {currentText}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isRecording && isConnected ? '🎯 Ready to Transcribe' : '🚀 Transcription Ready'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                {isRecording && isConnected
                  ? 'Speak clearly to see live transcription with unlimited duration'
                  : 'Start recording to begin unlimited live transcription with smart speaker detection'
                }
              </p>
              {!isRecording && (
                <div className="mt-4 text-xs text-gray-500 space-y-1">
                  <div>✨ Unlimited transcription duration</div>
                  <div>🎯 Smart speaker identification</div>
                  <div>🧠 Real-time AI processing</div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
