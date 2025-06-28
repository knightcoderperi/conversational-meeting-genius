import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MeetingControlCenter } from '@/components/meeting/MeetingControlCenter';
import { EnhancedRealtimeTranscription } from '@/components/meeting/EnhancedRealtimeTranscription';
import { SuperchargedAIChatbot } from '@/components/meeting/SuperchargedAIChatbot';
import { LiveMeetingAnalytics } from '@/components/meeting/LiveMeetingAnalytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, BarChart3, MessageSquare, Brain, Zap, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

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

export const EnhancedMeetingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[]>([]);
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
    console.log('🎬 Enhanced recording started with unlimited duration:', stream);
    toast.success('🚀 Recording started with unlimited duration!', {
      description: 'AI transcription and analysis active'
    });
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setMediaStream(null);
    console.log('⏹️ Enhanced recording stopped');

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
        toast.success('✅ Meeting completed and saved successfully!');
      }
    }
  };

  const handleTranscriptionUpdate = (segments: TranscriptionSegment[]) => {
    setTranscriptionSegments(segments);
    console.log('📝 Transcription updated:', segments.length, 'segments');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            🚀 Loading AI Meeting Platform
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Preparing unlimited transcription system...
          </p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Meeting not found
          </h2>
          <Link to="/">
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Enhanced Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors duration-200 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-6"></div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {meeting.title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 capitalize flex items-center">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {meeting.platform} Meeting • AI-Powered
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
                <Zap className="w-3 h-3 mr-1" />
                Unlimited
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Recording & Transcription */}
          <div className="space-y-6">
            <MeetingControlCenter
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

          {/* Right Column - Enhanced Tabs */}
          <div>
            <Card className="h-[calc(100vh-8rem)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border-0 shadow-2xl">
              <Tabs defaultValue="chat" className="flex flex-col h-full">
                <div className="border-b bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4">
                  <TabsList className="grid w-full grid-cols-3 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm">
                    <TabsTrigger value="chat" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                      <Brain className="w-4 h-4" />
                      <span>AI Chat</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytics</span>
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white">
                      <Users className="w-4 h-4" />
                      <span>Speakers</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="chat" className="h-full m-0">
                    <div className="p-4 h-full">
                      <SuperchargedAIChatbot 
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
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center">
                          <Users className="w-5 h-5 mr-2 text-blue-500" />
                          Smart Speaker Detection
                        </h3>
                        {transcriptionSegments.length > 0 ? (
                          <div className="space-y-3">
                            {Array.from(new Set(transcriptionSegments.filter(s => s.isFinal).map(s => s.speaker))).map((speaker) => {
                              const speakerSegments = transcriptionSegments.filter(s => s.speaker === speaker && s.isFinal);
                              const totalWords = speakerSegments.reduce((sum, s) => sum + s.text.split(' ').length, 0);
                              const avgConfidence = Math.round(speakerSegments.reduce((sum, s) => sum + s.confidence, 0) / speakerSegments.length * 100);
                              
                              return (
                                <div key={speaker} className="group hover:scale-105 transition-all duration-300">
                                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-white to-blue-50 dark:from-slate-800 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
                                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                      <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-bold text-gray-900 dark:text-white text-lg">{speaker}</p>
                                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300 mt-1">
                                        <span className="flex items-center">
                                          <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                                          {speakerSegments.length} segments
                                        </span>
                                        <span className="flex items-center">
                                          <Zap className="w-3 h-3 mr-1 text-green-500" />
                                          {totalWords} words
                                        </span>
                                        <span className="flex items-center">
                                          <BarChart3 className="w-3 h-3 mr-1 text-purple-500" />
                                          {avgConfidence}% accuracy
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12 animate-fade-in">
                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                              <Users className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              🎯 Smart Speaker Detection Ready
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                              {isRecording 
                                ? 'AI will automatically identify and track speakers as they participate in the meeting' 
                                : 'Start recording to enable intelligent speaker identification and analysis'}
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
