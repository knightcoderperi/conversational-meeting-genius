import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MeetingControlCenter } from '@/components/meeting/MeetingControlCenter';
import { AdvancedMultiSpeakerTranscription } from '@/components/meeting/AdvancedMultiSpeakerTranscription';
import { IntelligentChatbot } from '@/components/meeting/IntelligentChatbot';
import { LiveMeetingAnalytics } from '@/components/meeting/LiveMeetingAnalytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, BarChart3, MessageSquare, Brain, Zap, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

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
      description: 'Advanced AI transcription and multi-speaker analysis active'
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
        
        // Auto-redirect to analytics page immediately with a beautiful transition
        setTimeout(() => {
          navigate(`/meeting/${meeting.id}/view-analytics`);
        }, 1000);
      }
    }
  };

  const handleTranscriptionUpdate = (segments: TranscriptionSegment[]) => {
    setTranscriptionSegments(segments);
    console.log('📝 Enhanced transcription updated:', segments.length, 'segments');
    
    // Show success toast for significant updates
    if (segments.length > 0 && segments.length % 5 === 0) {
      toast.success(`🎯 ${segments.length} segments transcribed with AI speaker detection!`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            🚀 Loading Ultimate AI Meeting Platform
          </h2>
          <p className="text-purple-300">
            Preparing advanced transcription system...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Meeting not found
          </h2>
          <Link to="/">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800">
      {/* Enhanced Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="flex items-center text-purple-300 hover:text-purple-100 transition-colors duration-200 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <div className="border-l border-purple-500/30 h-6"></div>
              <div className="flex items-center space-x-3">
                <img 
                  src="/lovable-uploads/9edb3bf5-360c-407d-a8a0-289819c45c66.png" 
                  alt="OmniMeet" 
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {meeting.title}
                  </h1>
                  <p className="text-sm text-purple-300 capitalize flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {meeting.platform} Meeting • Ultimate AI-Powered
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 animate-pulse">
                <Zap className="w-3 h-3 mr-1" />
                Unlimited
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Recording & Advanced Transcription */}
          <div className="space-y-6">
            <MeetingControlCenter
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              meetingId={meeting.id}
              isRecording={isRecording}
            />
            
            <AdvancedMultiSpeakerTranscription
              meetingId={meeting.id}
              isRecording={isRecording}
              mediaStream={mediaStream}
              onTranscriptionUpdate={handleTranscriptionUpdate}
            />
          </div>

          {/* Right Column - Enhanced Tabs */}
          <div>
            <Card className="h-[calc(100vh-8rem)] bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-2xl">
              <Tabs defaultValue="chat" className="flex flex-col h-full">
                <div className="border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-4">
                  <TabsList className="grid w-full grid-cols-4 bg-black/40 backdrop-blur-sm">
                    <TabsTrigger value="chat" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                      <Brain className="w-4 h-4" />
                      <span>AI Assistant</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytics</span>
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
                      <Users className="w-4 h-4" />
                      <span>Speakers</span>
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
                      <TrendingUp className="w-4 h-4" />
                      <span>Insights</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="chat" className="h-full m-0">
                    <div className="p-4 h-full">
                      <IntelligentChatbot 
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
                        <h3 className="font-bold text-xl text-white flex items-center">
                          <Users className="w-5 h-5 mr-2 text-purple-400" />
                          Advanced Speaker Detection
                        </h3>
                        {transcriptionSegments.length > 0 ? (
                          <div className="space-y-3">
                            {Array.from(new Set(transcriptionSegments.filter(s => s.isFinal).map(s => s.speaker))).map((speaker) => {
                              const speakerSegments = transcriptionSegments.filter(s => s.speaker === speaker && s.isFinal);
                              const totalWords = speakerSegments.reduce((sum, s) => sum + s.text.split(' ').length, 0);
                              const avgConfidence = Math.round(speakerSegments.reduce((sum, s) => sum + s.confidence, 0) / speakerSegments.length * 100);
                              
                              return (
                                <motion.div 
                                  key={speaker} 
                                  className="group hover:scale-105 transition-all duration-300"
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-white/10 to-purple-500/10 rounded-xl border border-purple-500/30 shadow-lg backdrop-blur-sm">
                                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                      <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-bold text-white text-lg">{speaker}</p>
                                      <div className="flex items-center space-x-4 text-sm text-purple-300 mt-1">
                                        <span className="flex items-center">
                                          <MessageSquare className="w-3 h-3 mr-1 text-blue-400" />
                                          {speakerSegments.length} segments
                                        </span>
                                        <span className="flex items-center">
                                          <Zap className="w-3 h-3 mr-1 text-emerald-400" />
                                          {totalWords} words
                                        </span>
                                        <span className="flex items-center">
                                          <BarChart3 className="w-3 h-3 mr-1 text-pink-400" />
                                          {avgConfidence}% accuracy
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12 animate-fade-in">
                            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                              <Users className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-lg font-semibold text-white mb-2">
                              🎯 Advanced Speaker Detection Ready
                            </h4>
                            <p className="text-sm text-purple-300 max-w-sm mx-auto">
                              {isRecording 
                                ? 'Ultimate AI will automatically identify and track speakers with advanced voice analysis and video processing' 
                                : 'Start recording to enable intelligent multi-speaker identification and real-time analysis'}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </TabsContent>

                  <TabsContent value="insights" className="h-full m-0">
                    <CardContent className="p-4 h-full">
                      <div className="space-y-4">
                        <h3 className="font-bold text-xl text-white flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
                          Meeting Insights
                        </h3>
                        {transcriptionSegments.length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 p-4 rounded-lg border border-blue-500/30">
                                <h4 className="font-semibold text-white mb-2">Total Segments</h4>
                                <p className="text-2xl font-bold text-blue-400">{transcriptionSegments.length}</p>
                              </div>
                              <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 p-4 rounded-lg border border-emerald-500/30">
                                <h4 className="font-semibold text-white mb-2">Active Speakers</h4>
                                <p className="text-2xl font-bold text-emerald-400">
                                  {new Set(transcriptionSegments.map(s => s.speaker)).size}
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={() => navigate(`/meeting/${meeting.id}/view-analytics`)}
                              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            >
                              <TrendingUp className="w-4 h-4 mr-2" />
                              View Full Analytics
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <TrendingUp className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                            <p className="text-purple-300 text-sm">
                              Start recording to see meeting insights and analytics.
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
