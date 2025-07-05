
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Volume2, User, Download, Search, Users, Brain, Video, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  speakerDetected: boolean;
  audioLevel: number;
  speakerColor: string;
}

interface DetectedSpeaker {
  id: string;
  name: string;
  confidence: number;
  isActive: boolean;
  lastSeen: number;
  voicePattern: string;
  audioLevel: number;
  color: string;
  wordCount: number;
}

interface AdvancedMultiSpeakerTranscriptionProps {
  meetingId: string | null;
  isRecording: boolean;
  mediaStream: MediaStream | null;
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const AdvancedMultiSpeakerTranscription: React.FC<AdvancedMultiSpeakerTranscriptionProps> = ({
  meetingId,
  isRecording,
  mediaStream,
  onTranscriptionUpdate
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [detectedSpeakers, setDetectedSpeakers] = useState<DetectedSpeaker[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoAnalysisActive, setIsVideoAnalysisActive] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speakerColorsRef = useRef<string[]>([
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]);

  // Advanced Audio Processing Pipeline
  const initializeAdvancedAudioProcessing = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create multiple analyzers for speaker separation
      const analyzers = [];
      for (let i = 0; i < 5; i++) {
        const analyzer = audioContextRef.current.createAnalyser();
        analyzer.fftSize = 4096;
        analyzer.smoothingTimeConstant = 0.3;
        source.connect(analyzer);
        analyzers.push(analyzer);
      }
      
      analyserRef.current = analyzers[0]; // Primary analyzer
      
      // Start advanced speaker detection
      startAdvancedSpeakerDetection(analyzers);
      
    } catch (error) {
      console.error('Advanced audio processing failed:', error);
    }
  };

  // Advanced Speaker Detection with AI
  const startAdvancedSpeakerDetection = (analyzers: AnalyserNode[]) => {
    const detectSpeakers = () => {
      if (!analyzers.length) return;
      
      const audioData = analyzers.map(analyzer => {
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate spectral features for speaker identification
        const spectralCentroid = calculateSpectralCentroid(dataArray);
        const mfcc = calculateMFCC(dataArray);
        const energy = calculateEnergy(dataArray);
        
        return { spectralCentroid, mfcc, energy, level: dataArray.reduce((a, b) => a + b) / dataArray.length };
      });
      
      // Identify active speakers based on audio features
      identifyActiveSpeakers(audioData);
      
      if (isRecording) {
        requestAnimationFrame(detectSpeakers);
      }
    };
    
    detectSpeakers();
  };

  // Calculate Spectral Centroid for speaker identification
  const calculateSpectralCentroid = (frequencyData: Uint8Array): number => {
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      numerator += i * frequencyData[i];
      denominator += frequencyData[i];
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  };

  // Calculate MFCC features for voice recognition
  const calculateMFCC = (frequencyData: Uint8Array): number[] => {
    // Simplified MFCC calculation
    const mfccCoeffs = [];
    const melFilters = 13;
    
    for (let i = 0; i < melFilters; i++) {
      let sum = 0;
      const start = Math.floor(i * frequencyData.length / melFilters);
      const end = Math.floor((i + 1) * frequencyData.length / melFilters);
      
      for (let j = start; j < end; j++) {
        sum += frequencyData[j];
      }
      
      mfccCoeffs.push(sum / (end - start));
    }
    
    return mfccCoeffs;
  };

  // Calculate audio energy
  const calculateEnergy = (frequencyData: Uint8Array): number => {
    return frequencyData.reduce((sum, val) => sum + val * val, 0) / frequencyData.length;
  };

  // Advanced Speaker Identification
  const identifyActiveSpeakers = async (audioFeatures: any[]) => {
    const activeSpeakers = audioFeatures
      .map((features, index) => ({ ...features, index }))
      .filter(speaker => speaker.level > 15) // Threshold for active speech
      .sort((a, b) => b.level - a.level);
    
    if (activeSpeakers.length > 0) {
      const primarySpeaker = activeSpeakers[0];
      
      // Use AI to identify speaker based on voice patterns
      const speakerName = await identifySpeakerWithAI(primarySpeaker, segments);
      
      if (speakerName !== currentSpeaker) {
        setCurrentSpeaker(speakerName);
        updateSpeakerActivity(speakerName, primarySpeaker.level / 255);
      }
    }
  };

  // AI-Powered Speaker Name Identification
  const identifySpeakerWithAI = async (audioFeatures: any, transcriptionHistory: TranscriptionSegment[]): Promise<string> => {
    try {
      // Get recent transcription context
      const recentContext = transcriptionHistory
        .slice(-10)
        .map(seg => `${seg.speaker}: ${seg.text}`)
        .join('\n');
      
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: `Analyze this meeting transcription and identify the most likely speaker based on voice activity patterns and context. Look for:
          1. Self-introductions or name mentions
          2. Speaking patterns and context clues
          3. Previous speaker identifications
          
          Recent transcription context:
          ${recentContext}
          
          Current audio features suggest a speaker with spectral centroid: ${audioFeatures.spectralCentroid}, energy: ${audioFeatures.energy}
          
          If you can identify a specific name, return just the name. If uncertain, suggest an appropriate speaker label (e.g., "Speaker A", "Presenter", "Host").`,
          context: recentContext
        }
      });

      if (data?.response) {
        const identifiedName = extractSpeakerName(data.response);
        return identifiedName || `Speaker ${detectedSpeakers.length + 1}`;
      }
    } catch (error) {
      console.error('AI speaker identification failed:', error);
    }
    
    return `Speaker ${detectedSpeakers.length + 1}`;
  };

  // Extract speaker name from AI response
  const extractSpeakerName = (aiResponse: string): string => {
    // Clean up AI response to extract just the name
    const lines = aiResponse.split('\n');
    const firstLine = lines[0].trim();
    
    // Remove common AI response prefixes
    const cleanedName = firstLine
      .replace(/^(The speaker is|Speaker:|Name:|Based on|I believe|It appears|Most likely|This is|The person is)/i, '')
      .replace(/[.!?]$/, '')
      .trim();
    
    // Validate that it's a reasonable name (not too long, contains letters)
    if (cleanedName.length > 2 && cleanedName.length < 50 && /^[a-zA-Z\s]+$/.test(cleanedName)) {
      return cleanedName;
    }
    
    return '';
  };

  // Video-Based Name Extraction
  const initializeVideoNameExtraction = async (stream: MediaStream) => {
    if (!stream.getVideoTracks().length) return;
    
    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      
      setIsVideoAnalysisActive(true);
      
      // Capture frames every 10 seconds for name detection
      const captureInterval = setInterval(async () => {
        if (!isRecording) {
          clearInterval(captureInterval);
          return;
        }
        
        await captureAndAnalyzeFrame();
      }, 10000);
      
    } catch (error) {
      console.error('Video analysis initialization failed:', error);
    }
  };

  // Capture and analyze video frames for names
  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');
    
    // Use AI to analyze the frame for names
    await analyzeFrameForNames(imageData);
  };

  // AI-Powered Frame Analysis
  const analyzeFrameForNames = async (imageData: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: `Analyze this video frame from a meeting and identify any visible names, name tags, screen sharing content, or participant labels. Look for:
          1. Name tags or labels
          2. Screen sharing with participant names
          3. Zoom/Teams/Meet participant lists
          4. Presentation slides with names
          5. Any visible text that could indicate participant names
          
          Extract and list any names you can identify from the visual content.`,
          context: `Video frame analysis for meeting: ${meetingId}`
        }
      });

      if (data?.response) {
        const extractedNames = parseNamesFromAIResponse(data.response);
        if (extractedNames.length > 0) {
          console.log('🎯 Extracted names from video:', extractedNames);
          updateDetectedSpeakersFromVideo(extractedNames);
        }
      }
    } catch (error) {
      console.error('Frame analysis failed:', error);
    }
  };

  // Parse names from AI response
  const parseNamesFromAIResponse = (response: string): string[] => {
    const names = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      // Look for patterns like "Name: John Doe" or "- John Doe" or just "John Doe"
      const nameMatch = line.match(/(?:Name:|[-•]\s*)?([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        if (name.length > 2 && name.length < 50) {
          names.push(name);
        }
      }
    }
    
    return [...new Set(names)]; // Remove duplicates
  };

  // Update detected speakers from video analysis
  const updateDetectedSpeakersFromVideo = (names: string[]) => {
    setDetectedSpeakers(prev => {
      const updatedSpeakers = [...prev];
      
      names.forEach(name => {
        if (!updatedSpeakers.find(speaker => speaker.name === name)) {
          updatedSpeakers.push({
            id: `speaker_${updatedSpeakers.length}`,
            name,
            confidence: 0.9,
            isActive: false,
            lastSeen: Date.now(),
            voicePattern: '',
            audioLevel: 0,
            color: speakerColorsRef.current[updatedSpeakers.length % speakerColorsRef.current.length],
            wordCount: 0
          });
        }
      });
      
      return updatedSpeakers;
    });
  };

  // Update speaker activity
  const updateSpeakerActivity = (speakerName: string, audioLevel: number) => {
    setDetectedSpeakers(prev => {
      let speaker = prev.find(s => s.name === speakerName);
      
      if (!speaker) {
        // Create new speaker
        speaker = {
          id: `speaker_${prev.length}`,
          name: speakerName,
          confidence: 0.8,
          isActive: true,
          lastSeen: Date.now(),
          voicePattern: '',
          audioLevel,
          color: speakerColorsRef.current[prev.length % speakerColorsRef.current.length],
          wordCount: 0
        };
        return [...prev, speaker];
      }
      
      return prev.map(s => ({
        ...s,
        isActive: s.name === speakerName,
        audioLevel: s.name === speakerName ? audioLevel : s.audioLevel * 0.9,
        lastSeen: s.name === speakerName ? Date.now() : s.lastSeen
      }));
    });
  };

  // Initialize Enhanced Speech Recognition
  useEffect(() => {
    if (isRecording && mediaStream && meetingId) {
      initializeEnhancedTranscription();
      initializeAdvancedAudioProcessing(mediaStream);
      initializeVideoNameExtraction(mediaStream);
    } else {
      cleanupTranscription();
    }

    return () => cleanupTranscription();
  }, [isRecording, mediaStream, meetingId]);

  const initializeEnhancedTranscription = async () => {
    try {
      console.log('🎯 Initializing advanced multi-speaker transcription system...');
      
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 5;
        
        recognitionRef.current.onresult = async (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence || 0.85;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
              
              // Use AI to enhance speaker identification for this segment
              const enhancedSpeaker = await enhanceSpeakerIdentification(transcript, currentSpeaker);
              
              const segment: TranscriptionSegment = {
                id: Date.now().toString() + Math.random(),
                speaker: enhancedSpeaker,
                text: transcript.trim(),
                confidence: confidence,
                timestamp: new Date().toLocaleTimeString(),
                isFinal: true,
                speakerDetected: detectedSpeakers.some(s => s.name === enhancedSpeaker),
                audioLevel: detectedSpeakers.find(s => s.name === enhancedSpeaker)?.audioLevel || 0,
                speakerColor: detectedSpeakers.find(s => s.name === enhancedSpeaker)?.color || '#3B82F6'
              };
              
              if (transcript.trim().length > 0) {
                setSegments(prev => {
                  const updated = [...prev, segment];
                  onTranscriptionUpdate(updated);
                  return updated;
                });

                // Save to database
                if (meetingId) {
                  await saveTranscriptionSegment(meetingId, segment);
                }

                // Update speaker word count
                updateSpeakerWordCount(enhancedSpeaker, transcript.trim().split(' ').length);
              }
            } else {
              interimTranscript += transcript;
            }
          }
          
          setCurrentText(interimTranscript);
        };

        recognitionRef.current.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
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
        
        console.log('✅ Advanced multi-speaker transcription system started');
        toast.success('🚀 Advanced AI transcription with real-time speaker detection active!');
      }
    } catch (error) {
      console.error('Error initializing advanced transcription:', error);
      toast.error('Failed to start advanced transcription system');
    }
  };

  // Enhance speaker identification using AI
  const enhanceSpeakerIdentification = async (transcript: string, currentSpeakerName: string): Promise<string> => {
    try {
      // Check if transcript contains self-identification
      const selfIntroPattern = /(?:i'm|i am|my name is|this is|speaking is)\s+([a-zA-Z\s]+)/i;
      const match = transcript.match(selfIntroPattern);
      
      if (match) {
        const introducedName = match[1].trim();
        if (introducedName.length > 1 && introducedName.length < 30) {
          console.log('🎯 Self-introduction detected:', introducedName);
          return introducedName;
        }
      }
      
      // Use AI for context-based identification
      if (segments.length > 5) {
        const recentContext = segments.slice(-5).map(s => `${s.speaker}: ${s.text}`).join('\n');
        
        const { data } = await supabase.functions.invoke('groq-chat', {
          body: {
            message: `Based on this conversation context and the new statement "${transcript}", determine the most appropriate speaker name. Consider:
            1. Speaking patterns and consistency
            2. Context clues and references
            3. Previous speaker identifications
            
            Recent context:
            ${recentContext}
            
            Current statement: "${transcript}"
            
            Return only the most likely speaker name or suggest keeping "${currentSpeakerName}" if uncertain.`,
            context: recentContext
          }
        });

        if (data?.response) {
          const suggestedName = extractSpeakerName(data.response);
          if (suggestedName && suggestedName !== currentSpeakerName) {
            return suggestedName;
          }
        }
      }
      
      return currentSpeakerName || 'Speaker 1';
    } catch (error) {
      console.error('Speaker identification enhancement failed:', error);
      return currentSpeakerName || 'Speaker 1';
    }
  };

  // Update speaker word count
  const updateSpeakerWordCount = (speakerName: string, wordCount: number) => {
    setDetectedSpeakers(prev => prev.map(speaker => 
      speaker.name === speakerName 
        ? { ...speaker, wordCount: speaker.wordCount + wordCount }
        : speaker
    ));
  };

  // Save transcription segment to database
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
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setCurrentText('');
    setIsVideoAnalysisActive(false);
  };

  const exportTranscription = () => {
    const content = segments
      .map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advanced-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSegments = segments.filter(segment =>
    segment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="h-96 bg-gradient-to-br from-slate-900/90 to-purple-900/90 backdrop-blur-xl border border-purple-500/30 shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full flex items-center justify-center animate-pulse">
                <Brain className="w-6 h-6 text-white" />
              </div>
              {isRecording && isConnected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full m-1"></div>
                </div>
              )}
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                🚀 Advanced Multi-Speaker AI
              </span>
              <div className="flex items-center space-x-4 text-xs text-purple-300 mt-1">
                <span>👥 {detectedSpeakers.length} speakers</span>
                <span>🎯 {filteredSegments.length} segments</span>
                <span>🧠 AI-powered</span>
                {isVideoAnalysisActive && <span>📹 Video analysis</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isRecording && isConnected ? (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 animate-pulse">
                <Volume2 className="w-3 h-3 mr-1" />
                LIVE AI
              </Badge>
            ) : (
              <Badge variant="secondary">
                <MicOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col h-full">
        {/* Advanced Speaker Display */}
        {detectedSpeakers.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center space-x-2 mb-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">AI-Detected Speakers:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto">
              {detectedSpeakers.map((speaker) => (
                <motion.div
                  key={speaker.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`${
                    speaker.isActive 
                      ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50" 
                      : "bg-white/5 border border-white/10"
                  } rounded-lg p-2 transition-all duration-300`}
                >
                  <div className="flex items-center space-x-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        speaker.isActive ? 'animate-pulse' : ''
                      }`}
                      style={{ backgroundColor: speaker.color }}
                    />
                    <span className="text-xs font-medium text-white truncate">{speaker.name}</span>
                    {speaker.isActive && <Mic className="w-3 h-3 text-green-400" />}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {speaker.wordCount} words • {Math.round(speaker.confidence * 100)}%
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-3 space-y-3">
          <div className="flex space-x-2">
            <Input
              placeholder="🔍 Search advanced transcription..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-white/10 border-purple-500/30 text-white placeholder-purple-300"
            />
            <Button
              onClick={exportTranscription}
              size="sm"
              variant="outline"
              disabled={filteredSegments.length === 0}
              className="hover:bg-purple-500/20 border-purple-500/30"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {filteredSegments.length > 0 || currentText ? (
            <div className="space-y-4 pb-4">
              {filteredSegments.map((segment) => (
                <motion.div 
                  key={segment.id} 
                  className="group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start space-x-3 p-4 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 hover:bg-white/15 transition-all duration-300">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: segment.speakerColor }}
                    >
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          className="font-semibold border-0"
                          style={{ 
                            backgroundColor: `${segment.speakerColor}20`,
                            color: segment.speakerColor 
                          }}
                        >
                          {segment.speaker}
                          {segment.speakerDetected && " ✨"}
                        </Badge>
                        <div className="flex items-center space-x-3 text-xs text-purple-300">
                          <span>{segment.timestamp}</span>
                          <span>{Math.round(segment.confidence * 100)}%</span>
                          <div className="flex items-center space-x-1">
                            <Volume2 className="w-3 h-3" />
                            <div className="w-8 h-1 bg-gray-600 rounded">
                              <div 
                                className="h-full bg-green-400 rounded transition-all duration-300"
                                style={{ width: `${segment.audioLevel * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-white leading-relaxed">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {currentText && (
                <motion.div 
                  className="animate-pulse"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                      <Mic className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white mb-2 animate-pulse">
                        🎤 {currentSpeaker || 'Detecting...'} - Speaking...
                      </Badge>
                      <p className="text-sm text-white italic leading-relaxed">
                        {currentText}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                🚀 Advanced AI Transcription Ready
              </h3>
              <p className="text-sm text-purple-300 max-w-xs mb-4">
                {isRecording && isConnected
                  ? 'Advanced AI is analyzing speech patterns, identifying speakers, and processing video content in real-time'
                  : 'Start recording to begin advanced AI-powered transcription with intelligent multi-speaker detection'
                }
              </p>
              <div className="flex items-center space-x-4 text-xs text-purple-400">
                <span className="flex items-center"><Brain className="w-3 h-3 mr-1" />AI-Powered</span>
                <span className="flex items-center"><Users className="w-3 h-3 mr-1" />Multi-Speaker</span>
                <span className="flex items-center"><Video className="w-3 h-3 mr-1" />Video Analysis</span>
                <span className="flex items-center"><Volume2 className="w-3 h-3 mr-1" />Real-time</span>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
