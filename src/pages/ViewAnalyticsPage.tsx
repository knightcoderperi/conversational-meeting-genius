
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BarChart3, Clock, Users, MessageSquare, TrendingUp, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  start_time: string;
  end_time: string;
  duration: number;
}

interface AnalyticsData {
  totalDuration: number;
  totalSpeakers: number;
  totalWords: number;
  averageConfidence: number;
  speakerBreakdown: Array<{
    name: string;
    speakingTime: number;
    wordCount: number;
    segments: number;
  }>;
  timelineData: Array<{
    time: string;
    activity: number;
    speakers: number;
  }>;
  topicsData: Array<{
    topic: string;
    frequency: number;
    sentiment: number;
  }>;
}

export const ViewAnalyticsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && user) {
      fetchMeetingAndAnalytics();
    }
  }, [id, user]);

  const fetchMeetingAndAnalytics = async () => {
    try {
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) {
        toast.error('Meeting not found');
        navigate('/');
        return;
      }

      setMeeting(meetingData);

      // Fetch transcription segments for analytics
      const { data: segments, error: segmentsError } = await supabase
        .from('transcription_segments')
        .select('*')
        .eq('meeting_id', id)
        .order('start_time', { ascending: true });

      if (segmentsError) {
        console.error('Error fetching segments:', segmentsError);
      }

      // Process analytics data
      if (segments && segments.length > 0) {
        const processedAnalytics = processAnalyticsData(segments);
        setAnalytics(processedAnalytics);
      } else {
        // Create empty analytics
        setAnalytics({
          totalDuration: meetingData.duration || 0,
          totalSpeakers: 0,
          totalWords: 0,
          averageConfidence: 0,
          speakerBreakdown: [],
          timelineData: [],
          topicsData: []
        });
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (segments: any[]): AnalyticsData => {
    // Speaker breakdown
    const speakerMap = new Map();
    let totalWords = 0;
    let totalConfidence = 0;

    segments.forEach(segment => {
      const speakerName = segment.speaker_name || segment.speaker_id || 'Unknown';
      const words = segment.text.split(' ').length;
      totalWords += words;
      totalConfidence += segment.confidence || 0;

      if (!speakerMap.has(speakerName)) {
        speakerMap.set(speakerName, {
          name: speakerName,
          speakingTime: 0,
          wordCount: 0,
          segments: 0
        });
      }

      const speaker = speakerMap.get(speakerName);
      speaker.speakingTime += (segment.end_time - segment.start_time);
      speaker.wordCount += words;
      speaker.segments += 1;
    });

    // Timeline data (activity over time)
    const timelineMap = new Map();
    segments.forEach(segment => {
      const timeSlot = Math.floor(segment.start_time / 60) * 60; // 1-minute slots
      if (!timelineMap.has(timeSlot)) {
        timelineMap.set(timeSlot, {
          time: formatTime(timeSlot),
          activity: 0,
          speakers: new Set()
        });
      }
      const slot = timelineMap.get(timeSlot);
      slot.activity += 1;
      slot.speakers.add(segment.speaker_name || segment.speaker_id);
    });

    const timelineData = Array.from(timelineMap.values()).map(slot => ({
      time: slot.time,
      activity: slot.activity,
      speakers: slot.speakers.size
    }));

    // Top topics (mock data for now - in real implementation, use NLP)
    const topicsData = [
      { topic: 'Project Updates', frequency: 15, sentiment: 0.7 },
      { topic: 'Budget Discussion', frequency: 12, sentiment: 0.3 },
      { topic: 'Timeline Planning', frequency: 8, sentiment: 0.6 },
      { topic: 'Team Assignments', frequency: 6, sentiment: 0.8 },
      { topic: 'Risk Assessment', frequency: 4, sentiment: 0.2 }
    ];

    return {
      totalDuration: Math.max(...segments.map(s => s.end_time)) - Math.min(...segments.map(s => s.start_time)),
      totalSpeakers: speakerMap.size,
      totalWords,
      averageConfidence: segments.length > 0 ? totalConfidence / segments.length : 0,
      speakerBreakdown: Array.from(speakerMap.values()),
      timelineData: timelineData.slice(0, 20), // Limit to 20 data points
      topicsData
    };
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const exportAnalytics = () => {
    if (!analytics || !meeting) return;
    
    const data = {
      meeting: meeting.title,
      date: new Date(meeting.start_time).toLocaleDateString(),
      duration: formatDuration(analytics.totalDuration),
      speakers: analytics.totalSpeakers,
      totalWords: analytics.totalWords,
      averageConfidence: `${(analytics.averageConfidence * 100).toFixed(1)}%`,
      speakerBreakdown: analytics.speakerBreakdown
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title}-analytics.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Analytics exported successfully!');
  };

  const shareAnalytics = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${meeting?.title} - Meeting Analytics`,
          text: `Check out the analytics for our meeting: ${analytics?.totalSpeakers} speakers, ${analytics?.totalWords} words spoken`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Analytics link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Loading Analytics
          </h2>
          <p className="text-purple-300">
            Processing meeting data...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Meeting not found</h2>
          <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="flex items-center text-purple-300 hover:text-purple-100 transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Button>
              <div className="border-l border-purple-500/30 h-6"></div>
              <div className="flex items-center space-x-3">
                <img 
                  src="/lovable-uploads/9edb3bf5-360c-407d-a8a0-289819c45c66.png" 
                  alt="OmniMeet" 
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Meeting Analytics
                  </h1>
                  <p className="text-sm text-purple-300">{meeting.title}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={shareAnalytics}
                variant="outline"
                size="sm"
                className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button
                onClick={exportAnalytics}
                variant="outline"
                size="sm"
                className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: 'Duration',
              value: formatDuration(analytics?.totalDuration || 0),
              icon: Clock,
              color: 'from-blue-500 to-cyan-500'
            },
            {
              title: 'Speakers',
              value: analytics?.totalSpeakers || 0,
              icon: Users,
              color: 'from-emerald-500 to-teal-500'
            },
            {
              title: 'Total Words',
              value: analytics?.totalWords || 0,
              icon: MessageSquare,
              color: 'from-orange-500 to-red-500'
            },
            {
              title: 'Avg Confidence',
              value: `${((analytics?.averageConfidence || 0) * 100).toFixed(1)}%`,
              icon: TrendingUp,
              color: 'from-purple-500 to-pink-500'
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-300 mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Speaker Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="w-5 h-5 mr-2 text-purple-400" />
                  Speaker Distribution
                </CardTitle>
                <CardDescription className="text-purple-300">
                  Word count by speaker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.speakerBreakdown || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="wordCount"
                    >
                      {(analytics?.speakerBreakdown || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                        border: '1px solid #8B5CF6',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-emerald-400" />
                  Activity Timeline
                </CardTitle>
                <CardDescription className="text-purple-300">
                  Speaking activity over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics?.timelineData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                      stroke="#6B7280"
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                      stroke="#6B7280"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                        border: '1px solid #10B981',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="activity" 
                      stroke="#10B981" 
                      fill="url(#activityGradient)" 
                    />
                    <defs>
                      <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Detailed Speaker Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-orange-400" />
                Detailed Speaker Analytics
              </CardTitle>
              <CardDescription className="text-purple-300">
                Comprehensive breakdown of speaker participation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analytics?.speakerBreakdown || []).map((speaker, index) => (
                  <div key={speaker.name} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <div>
                        <h4 className="font-semibold text-white">{speaker.name}</h4>
                        <p className="text-sm text-purple-300">{speaker.segments} segments</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{speaker.wordCount} words</p>
                      <p className="text-sm text-purple-300">{formatDuration(speaker.speakingTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
