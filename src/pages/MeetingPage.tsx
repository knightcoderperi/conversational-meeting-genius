
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MeetingRecorder } from '@/components/meeting/MeetingRecorder';
import { EnhancedRealtimeTranscription } from '@/components/meeting/EnhancedRealtimeTranscription';
import { LiveAIChatbot } from '@/components/meeting/LiveAIChatbot';
import { LiveMeetingAnalytics } from '@/components/meeting/LiveMeetingAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, BarChart3, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { TranscriptionEntry } from '@/utils/integratedTranscriptionSystem';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  start_time: string;
}

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export const MeetingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [transcriptionEntries, setTranscriptionEntries] = useState<TranscriptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingStartTime] = useState(Date.now());

  useEffect(() => {
    if (id && user) {
      fetchMeeting();
    }
  }, [id, user]);

  const fetchMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        toast.error('Meeting not found');
        navigate('/');
        return;
      }

      setMeeting(data);
    } catch (error) {
      toast.error('Failed to load meeting');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = (stream: MediaStream) => {
    setMediaStream(stream);
    setIsRecording(true);
    console.log('Recording started with stream:', stream);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setMediaStream(null);
    console.log('Recording stopped');

    // Update meeting status
    if (meeting) {
      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          duration: Math.floor((Date.now() - new Date(meeting.start_time).getTime()) / 1000)
        })
        .eq('id', meeting.id);

      if (error) {
        console.error('Error updating meeting:', error);
      } else {
        toast.success('Meeting completed and saved!');
      }
    }
  };

  const handleTranscriptionUpdate = (entries: TranscriptionEntry[]) => {
    setTranscriptionEntries(entries);
    console.log('Transcription updated:', entries.length, 'entries');
  };

  // Convert TranscriptionEntry to TranscriptionSegment format
  const convertToTranscriptionSegments = (entries: TranscriptionEntry[]): TranscriptionSegment[] => {
    return entries.map(entry => ({
      id: entry.id,
      speaker: entry.speaker,
      text: entry.text,
      confidence: entry.confidence,
      timestamp: new Date(entry.timestamp).toLocaleTimeString(),
      isFinal: entry.isFinal
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Meeting not found
          </h2>
          <Link to="/">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const transcriptionSegments = convertToTranscriptionSegments(transcriptionEntries);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-6"></div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {meeting.title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                  {meeting.platform} Meeting
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Enhanced Recording & Transcription */}
          <div className="space-y-6">
            <MeetingRecorder
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              meetingId={meeting.id}
              isRecording={isRecording}
            />
            
            <EnhancedRealtimeTranscription
              meetingId={meeting.id}
              isRecording={isRecording}
              mediaStream={mediaStream}
              onTranscriptionUpdate={handleTranscriptionUpdate}
            />
          </div>

          {/* Right Column - Tabs */}
          <div>
            <Card className="h-[calc(100vh-8rem)]">
              <Tabs defaultValue="chat" className="flex flex-col h-full">
                <div className="border-b p-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="chat" className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>AI Chat</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytics</span>
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Speakers</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="chat" className="h-full m-0">
                    <div className="p-4 h-full">
                      <LiveAIChatbot 
                        meetingId={meeting.id}
                        transcriptionHistory={transcriptionSegments}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="h-full m-0">
                    <div className="p-4 h-full">
                      <LiveMeetingAnalytics 
                        meetingId={meeting.id}
                        transcriptionSegments={transcriptionSegments}
                        isRecording={isRecording}
                        startTime={meetingStartTime}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="participants" className="h-full m-0">
                    <CardContent className="p-4 h-full">
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Identified Speakers
                        </h3>
                        {transcriptionEntries.length > 0 ? (
                          <div className="space-y-3">
                            {Array.from(new Set(transcriptionEntries.filter(entry => entry.isFinal).map(entry => entry.speaker))).map((speaker) => {
                              const speakerEntries = transcriptionEntries.filter(entry => entry.speaker === speaker && entry.isFinal);
                              const totalWords = speakerEntries.reduce((sum, entry) => sum + entry.text.split(' ').length, 0);
                              const avgConfidence = Math.round(speakerEntries.reduce((sum, entry) => sum + entry.confidence, 0) / speakerEntries.length * 100);
                              
                              return (
                                <div key={speaker} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{speaker}</p>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                                      <span>{speakerEntries.length} segments</span>
                                      <span>{totalWords} words</span>
                                      <span>{avgConfidence}% accuracy</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {isRecording 
                                ? 'Speakers will appear here as they talk' 
                                : 'Start recording to identify speakers'}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </TabsContent>
                </div>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
