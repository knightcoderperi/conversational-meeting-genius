import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Play, Square, Download, Users, Mic, Volume2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { CompleteMultiSpeakerSystem, TranscriptionChunk, SpeakerProfile } from '@/utils/completeMultiSpeakerSystem';

interface CompleteMultiSpeakerRecorderProps {
  meetingId: string;
  onRecordingStateChange: (isRecording: boolean) => void;
}

export const CompleteMultiSpeakerRecorder: React.FC<CompleteMultiSpeakerRecorderProps> = ({
  meetingId,
  onRecordingStateChange
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcriptionChunks, setTranscriptionChunks] = useState<TranscriptionChunk[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [audioLevels, setAudioLevels] = useState({ mic: 0, system: 0 });
  
  const systemRef = useRef<CompleteMultiSpeakerSystem | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize the complete system
    systemRef.current = new CompleteMultiSpeakerSystem();
    
    // Setup event handlers
    systemRef.current.onTranscription((chunks) => {
      setTranscriptionChunks(chunks);
    });
    
    systemRef.current.onSpeaker((speaker) => {
      setSpeakers(prev => {
        const existing = prev.find(s => s.id === speaker.id);
        if (existing) {
          return prev.map(s => s.id === speaker.id ? speaker : s);
        }
        return [...prev, speaker];
      });
    });
    
    systemRef.current.onAudio((levels) => {
      setAudioLevels(levels);
    });

    return () => {
      if (systemRef.current) {
        systemRef.current.cleanup();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const setupAudioCapture = async () => {
    if (!systemRef.current) return;

    try {
      console.log('🔧 Starting audio capture setup...');
      toast.loading('Setting up audio capture... Please allow permissions when prompted.');
      await systemRef.current.setupCompleteAudioCapture();
      setIsSetup(true);
      toast.dismiss();
      toast.success('✅ Audio capture ready! Recording will start now.');
      console.log('✅ Audio capture setup completed successfully');
    } catch (error) {
      toast.dismiss();
      
      // Show user-friendly error messages
      if (error.message.includes('Permission denied')) {
        toast.error('❌ Please allow microphone and screen sharing permissions, then click the button again.');
      } else if (error.message.includes('not support')) {
        toast.error('❌ Please use Chrome, Firefox, or Edge browser for recording.');
      } else {
        toast.error(`❌ Setup failed: ${error.message}`);
      }
      
      console.error('❌ Setup error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  };

  const startRecording = async () => {
    console.log('🎬 Starting recording process...');
    
    if (!systemRef.current) {
      console.error('❌ System reference is null');
      toast.error('System not initialized');
      return;
    }

    if (!isSetup) {
      console.log('⚙️ Setup required, initializing audio capture...');
      await setupAudioCapture();
      if (!isSetup) {
        console.error('❌ Setup failed, cannot start recording');
        return;
      }
    }

    try {
      console.log('🎙️ Calling startRecording on system...');
      await systemRef.current.startRecording();
      setIsRecording(true);
      setRecordingTime(0);
      onRecordingStateChange(true);
      toast.success('🎙️ Recording started - capturing ALL speakers!');
      console.log('✅ Recording started successfully');
    } catch (error) {
      toast.error(`Failed to start recording: ${error.message}`);
      console.error('❌ Recording start error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  };

  const stopRecording = () => {
    if (!systemRef.current) return;

    systemRef.current.stopRecording();
    setIsRecording(false);
    onRecordingStateChange(false);
    toast.success('Recording stopped');
  };

  const exportTranscript = () => {
    if (!systemRef.current) return;

    const transcript = systemRef.current.exportTranscript();
    
    // Create downloadable file
    const blob = new Blob([JSON.stringify(transcript, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Transcript exported successfully!');
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

  const getSpeakerColor = (speakerId: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
    ];
    const index = speakerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-6">
      {/* Recording Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Complete Multi-Speaker Recording</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                AssemblyAI Ready
              </Badge>
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  LIVE - ALL SPEAKERS
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
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
                  <Play className="w-5 h-5 mr-2" />
                  Start Complete Multi-Speaker Recording
                </>
              )}
            </Button>
          </div>

          {isRecording && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(recordingTime)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Unlimited Duration Recording</p>
              </div>

              {/* Audio Level Indicators */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Your Voice</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Progress value={audioLevels.mic * 100} className="w-20 h-2" />
                    <span className="text-xs text-gray-500 w-8">{Math.round(audioLevels.mic * 100)}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">All Participants</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Progress value={audioLevels.system * 100} className="w-20 h-2" />
                    <span className="text-xs text-gray-500 w-8">{Math.round(audioLevels.system * 100)}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 text-center font-medium">
                  ✅ Capturing complete audio from ALL meeting participants with speaker identification
                </p>
              </div>
            </div>
          )}

          {!isRecording && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  <Zap className="w-4 h-4" />
                  <span>Complete Multi-Speaker System with AssemblyAI</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <div>🎤 Your microphone with noise suppression</div>
                  <div>🔊 Complete system audio capture (all remote speakers)</div>
                  <div>👥 Every participant's voice recorded clearly</div>
                  <div>⚡ Real-time audio level monitoring</div>
                  <div>🏷️ Speaker identification with real names</div>
                  <div>📝 Live transcription with timestamps</div>
                  <div>📊 Exportable transcripts with speaker analytics</div>
                  <div>⏱️ Unlimited recording duration</div>
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <div className="text-xs text-green-700 dark:text-green-300 text-center font-medium">
                  ✅ AssemblyAI transcription ready - no configuration needed!
                </div>
              </div>
            </div>
          )}

          {!isRecording && transcriptionChunks.length > 0 && (
            <Button onClick={exportTranscript} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export Complete Transcript
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Live Transcription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Live Multi-Speaker Transcription</span>
            </div>
            <Badge variant="outline">
              {transcriptionChunks.length} segments
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96 p-4">
            {transcriptionChunks.length > 0 ? (
              <div className="space-y-4">
                {transcriptionChunks.map((chunk) => (
                  <div key={chunk.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={getSpeakerColor(chunk.speakerId)}>
                        {chunk.speaker}
                      </Badge>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{new Date(chunk.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>{Math.round(chunk.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isRecording ? 'Listening to all speakers...' : 'Ready for complete recording'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isRecording
                    ? 'Real-time transcription with speaker identification will appear here'
                    : 'Start recording to capture all participants with speaker names'
                  }
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Speaker Analytics */}
      {speakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Identified Speakers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {speakers.map((speaker) => (
                <div key={speaker.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{speaker.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {Math.round(speaker.confidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-300">
                    <div>{speaker.totalWords} words</div>
                    <div>{Math.round(speaker.speakingTime)}s</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
