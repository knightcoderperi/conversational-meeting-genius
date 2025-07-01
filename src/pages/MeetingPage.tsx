
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CompleteMultiSpeakerRecorder } from '@/components/meeting/CompleteMultiSpeakerRecorder';
import { LiveAIChatbot } from '@/components/meeting/LiveAIChatbot';
import { LiveMeetingAnalytics } from '@/components/meeting/LiveMeetingAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, BarChart3, MessageSquare, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  start_time: string;
}

export const MeetingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
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

  const handleRecordingStateChange = async (recording: boolean) => {
    setIsRecording(recording);

    if (meeting) {
      if (!recording) {
        // Update meeting when recording stops
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
    }
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
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {meeting.title}
                  </h1>
                  {isRecording && (
                    <div className="flex items-center space-x-1">
                      <Zap className="w-4 h-4 text-green-600 animate-pulse" />
                      <span className="text-xs font-medium text-green-600">COMPLETE RECORDING</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                  {meeting.platform} Meeting • Multi-Speaker Capture
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Complete Multi-Speaker Recording */}
          <div className="space-y-6">
            <CompleteMultiSpeakerRecorder
              meetingId={meeting.id}
              onRecordingStateChange={handleRecordingStateChange}
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
                        transcriptionHistory={[]}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="h-full m-0">
                    <div className="p-4 h-full">
                      <LiveMeetingAnalytics 
                        meetingId={meeting.id}
                        transcriptionSegments={[]}
                        isRecording={isRecording}
                        startTime={meetingStartTime}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="participants" className="h-full m-0">
                    <CardContent className="p-4 h-full">
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Complete Multi-Speaker System
                        </h3>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center space-x-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
                            <Zap className="w-4 h-4" />
                            <span>Advanced Features Active</span>
                          </div>
                          <div className="space-y-2 text-xs text-blue-600 dark:text-blue-400">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Complete audio capture from ALL participants</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Real-time speaker identification</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Unlimited recording duration</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>High-quality audio processing</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Exportable transcripts with timestamps</span>
                            </div>
                          </div>
                        </div>

                        {!isRecording ? (
                          <div className="text-center py-8">
                            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Start the complete recording to see identified speakers with real names and audio levels
                            </p>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="animate-pulse">
                              <Users className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Analyzing audio and identifying speakers in real-time...
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
