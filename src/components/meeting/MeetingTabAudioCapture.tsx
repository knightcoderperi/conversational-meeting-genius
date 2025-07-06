import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2, Users, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface MeetingTabAudioCaptureProps {
  meetingId: string;
  onTranscriptionUpdate: (segments: TranscriptionSegment[]) => void;
}

export const MeetingTabAudioCapture: React.FC<MeetingTabAudioCaptureProps> = ({
  meetingId,
  onTranscriptionUpdate
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [identifiedSpeakers, setIdentifiedSpeakers] = useState<Map<string, string>>(new Map());
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speakerIdentificationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  const startTabAudioCapture = async () => {
    try {
      console.log('Starting comprehensive meeting capture (audio + video for speaker identification)...');
      
      // Request display media with BOTH audio and video for complete meeting capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: false, // Keep original meeting audio
          noiseSuppression: false, // Don't filter out other speakers
          autoGainControl: false,   // Preserve volume levels
          sampleRate: 44100,        // High quality audio
          channelCount: 2           // Stereo for better speaker separation
        }
      });

      // Verify we got audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available. Make sure to select "Share tab" and check "Share tab audio"');
      }

      console.log(`Captured ${audioTracks.length} audio tracks from meeting tab`);
      
      mediaStreamRef.current = stream;
      
      // Set up video element for speaker identification
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        if (!videoRef.current) {
          videoRef.current = document.createElement('video');
          videoRef.current.style.display = 'none';
          document.body.appendChild(videoRef.current);
        }
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start speaker identification from video frames
        startSpeakerIdentification();
      }
      
      // Set up MediaRecorder for chunked processing
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Process audio in chunks for real-time transcription
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Process this chunk for transcription
          const audioBlob = new Blob([event.data], { type: 'audio/webm' });
          await processAudioChunk(audioBlob);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Audio capture stopped');
      };

      // Start recording in 2-second chunks for real-time processing
      mediaRecorder.start(2000);
      setIsCapturing(true);
      
      toast.success('Capturing audio from ALL meeting participants!');

      // Handle stream end (user stops sharing)
      stream.getVideoTracks().forEach(track => {
        track.addEventListener('ended', stopCapture);
      });
      
      stream.getAudioTracks().forEach(track => {
        track.addEventListener('ended', stopCapture);
      });

    } catch (error) {
      console.error('Failed to start tab audio capture:', error);
      
      // Provide specific guidance based on error type
      if (error.name === 'NotAllowedError') {
        toast.error('Permission denied. Please allow screen sharing and make sure to check "Share tab audio"');
      } else if (error.name === 'NotFoundError') {
        toast.error('No tab selected. Please select a tab and enable "Share tab audio"');
      } else {
        toast.error(`Failed to capture meeting audio: ${error.message}`);
      }
      
      // Show detailed instructions
      setTimeout(() => {
        toast.info('Instructions: 1) Click "Capture Meeting Audio" 2) Select "Chrome Tab" 3) Choose your meeting tab 4) ✅ Check "Share tab audio" 5) Click Share', {
          duration: 8000
        });
      }, 1000);
    }
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64 for API transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Send to our enhanced transcription service
      const { data, error } = await supabase.functions.invoke('enhance-transcription', {
        body: {
          audio: base64Audio,
          meetingId: meetingId,
          enableSpeakerDiarization: true,
          realtime: true
        }
      });

      if (error) {
        console.error('Transcription error:', error);
        return;
      }

      if (data && data.segments) {
        // Update segments with new transcriptions and map to identified speakers
        const newSegments = data.segments.map((segment: any) => {
          const speakerId = segment.speaker || 'Unknown Speaker';
          const identifiedName = identifiedSpeakers.get(speakerId) || speakerId;
          
          return {
            id: `${Date.now()}_${Math.random()}`,
            speaker: identifiedName,
            text: segment.text,
            confidence: segment.confidence || 0.9,
            timestamp: new Date().toLocaleTimeString(),
            isFinal: segment.is_final || false
          };
        });

        setSegments(prev => {
          const updated = [...prev, ...newSegments];
          onTranscriptionUpdate(updated);
          return updated;
        });

        // Update active speakers
        const speakers = newSegments.map((s: TranscriptionSegment) => s.speaker);
        setActiveSpeakers(prev => {
          const allSpeakers = [...new Set([...prev, ...speakers])];
          return allSpeakers.slice(-5); // Keep last 5 active speakers
        });

        // Update current text for live preview
        const liveText = newSegments
          .filter((s: TranscriptionSegment) => !s.isFinal)
          .map((s: TranscriptionSegment) => s.text)
          .join(' ');
        setCurrentText(liveText);
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  const startSpeakerIdentification = () => {
    if (!videoRef.current || !canvasRef.current) {
      // Create canvas for frame capture
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.style.display = 'none';
      document.body.appendChild(canvasRef.current);
    }

    // Capture video frames every 5 seconds to identify speakers
    speakerIdentificationIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && isCapturing) {
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

          // Set canvas size to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob for speaker identification
          canvas.toBlob(async (blob) => {
            if (blob) {
              const arrayBuffer = await blob.arrayBuffer();
              const imageData = Array.from(new Uint8Array(arrayBuffer));
              
              // Send to speaker identification service
              const { data, error } = await supabase.functions.invoke('identify-speaker', {
                body: {
                  imageBlob: imageData,
                  meetingId: meetingId
                }
              });

              if (!error && data && data.speaker) {
                const speaker = data.speaker;
                console.log('Speaker identified:', speaker);
                
                // Update speaker mapping
                setIdentifiedSpeakers(prev => {
                  const updated = new Map(prev);
                  updated.set(speaker.id, speaker.name);
                  return updated;
                });
                
                toast.success(`Speaker identified: ${speaker.name}`);
              }
            }
          }, 'image/jpeg', 0.8);
          
        } catch (error) {
          console.error('Error in speaker identification:', error);
        }
      }
    }, 5000); // Check every 5 seconds
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    if (speakerIdentificationIntervalRef.current) {
      clearInterval(speakerIdentificationIntervalRef.current);
      speakerIdentificationIntervalRef.current = null;
    }

    // Clean up video and canvas elements
    if (videoRef.current) {
      document.body.removeChild(videoRef.current);
      videoRef.current = null;
    }
    
    if (canvasRef.current) {
      document.body.removeChild(canvasRef.current);
      canvasRef.current = null;
    }

    setIsCapturing(false);
    setCurrentText('');
    toast.success('Meeting audio capture stopped');
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
    ];
    return colors[speaker.length % colors.length];
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Monitor className="w-5 h-5" />
              <span>Meeting Audio Capture</span>
            </div>
            {isCapturing && (
              <Badge variant="default" className="bg-green-600">
                <Volume2 className="w-3 h-3 mr-1" />
                Capturing All Speakers
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={isCapturing ? stopCapture : startTabAudioCapture}
              size="lg"
              variant={isCapturing ? "destructive" : "default"}
              className="w-full"
            >
              {isCapturing ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Stop Audio Capture
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Capture Meeting Audio
                </>
              )}
            </Button>

            {!isCapturing && (
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p className="font-medium">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Click "Capture Meeting Audio"</li>
                  <li>Select "Share your screen" → "Chrome Tab"</li>
                  <li>Choose the tab with your meeting (Meet/Zoom/Teams)</li>
                  <li>✅ Check "Share tab audio" (CRITICAL)</li>
                  <li>Click "Share" to start capturing ALL participants</li>
                </ol>
              </div>
            )}

            {activeSpeakers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Speakers:</p>
                <div className="flex flex-wrap gap-2">
                  {activeSpeakers.map((speaker) => (
                    <Badge key={speaker} variant="outline" className={getSpeakerColor(speaker)}>
                      <Users className="w-3 h-3 mr-1" />
                      {speaker}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Transcription */}
      <Card className="h-96">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5" />
            <span>Live Multi-Speaker Transcription</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-80 p-4">
            {segments.length > 0 || currentText ? (
              <div className="space-y-4">
                {segments.map((segment) => (
                  <div key={segment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={getSpeakerColor(segment.speaker)}>
                        {segment.speaker}
                      </Badge>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{segment.timestamp}</span>
                        <span>•</span>
                        <span>{Math.round(segment.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {segment.text}
                    </p>
                  </div>
                ))}
                
                {currentText && (
                  <div className="space-y-2 opacity-70">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        Speaking...
                      </Badge>
                      <span className="text-xs text-gray-500">Live</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
                      {currentText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Monitor className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {isCapturing ? 'Listening to meeting...' : 'Ready to capture meeting audio'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isCapturing
                    ? 'All meeting participants will appear here as they speak'
                    : 'Start capturing to transcribe ALL meeting participants in real-time'
                  }
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};