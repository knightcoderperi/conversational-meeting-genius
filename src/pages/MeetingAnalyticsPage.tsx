
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Clock, MessageSquare, TrendingUp, BarChart3, Crown, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  start_time: string;
  end_time: string;
  duration: number;
}

interface SpeakerStats {
  name: string;
  segments: number;
  words: number;
  speakingTime: number;
  percentage: number;
  avgConfidence: number;
}

export const MeetingAnalyticsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [speakerStats, setSpeakerStats] = useState<SpeakerStats[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchMeetingAnalytics();
    }
  }, [id, user]);

  const fetchMeetingAnalytics = async () => {
    try {
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      // Fetch transcription segments for analytics
      const { data: segments, error: segmentsError } = await supabase
        .from('transcription_segments')
        .select('*')
        .eq('meeting_id', id)
        .eq('is_final', true);

      if (segmentsError) throw segmentsError;

      // Calculate speaker statistics
      if (segments && segments.length > 0) {
        const speakerMap: { [key: string]: SpeakerStats } = {};
        let total = 0;

        segments.forEach(segment => {
          const words = segment.text.trim().split(/\s+/).length;
          total += words;

          if (!speakerMap[segment.speaker_name]) {
            speakerMap[segment.speaker_name] = {
              name: segment.speaker_name,
              segments: 0,
              words: 0,
              speakingTime: 0,
              percentage: 0,
              avgConfidence: 0
            };
          }

          speakerMap[segment.speaker_name].segments += 1;
          speakerMap[segment.speaker_name].words += words;
          speakerMap[segment.speaker_name].speakingTime += (segment.end_time - segment.start_time);
          speakerMap[segment.speaker_name].avgConfidence += segment.confidence;
        });

        // Calculate percentages and averages
        const stats = Object.values(speakerMap).map(speaker => ({
          ...speaker,
          percentage: Math.round((speaker.words / total) * 100),
          avgConfidence: Math.round((speaker.avgConfidence / speaker.segments) * 100),
          speakingTime: Math.round(speaker.speakingTime)
        })).sort((a, b) => b.words - a.words);

        setSpeakerStats(stats);
        setTotalWords(total);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load meeting analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: 2999, // ₹29.99
          currency: 'INR',
          receipt: `upgrade_${user?.id}_${Date.now()}`,
          notes: {
            plan: 'pro_monthly',
            user_id: user?.id
          }
        }
      });

      if (error) throw error;

      // Initialize Razorpay
      const options = {
        key: 'your_razorpay_key_id', // You'll need to add this
        amount: data.amount,
        currency: data.currency,
        name: 'Meeting AI Pro',
        description: 'Upgrade to Pro Plan',
        order_id: data.id,
        handler: async (response: any) => {
          toast.success('Payment successful! Welcome to Pro!');
          // Update user subscription status
        },
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#3B82F6'
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initialize payment');
    }
  };

  const chartColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <div className="border-l border-gray-300 h-6"></div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Meeting Analytics
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {meeting?.title}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0 hover:shadow-lg transition-all"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="speakers">Speaker Analysis</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-8 h-8" />
                    <div>
                      <p className="text-blue-100">Duration</p>
                      <p className="text-2xl font-bold">
                        {Math.floor((meeting?.duration || 0) / 60)}m {(meeting?.duration || 0) % 60}s
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-8 h-8" />
                    <div>
                      <p className="text-green-100">Total Words</p>
                      <p className="text-2xl font-bold">{totalWords.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8" />
                    <div>
                      <p className="text-purple-100">Active Speakers</p>
                      <p className="text-2xl font-bold">{speakerStats.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-8 h-8" />
                    <div>
                      <p className="text-orange-100">Engagement</p>
                      <p className="text-2xl font-bold">94%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Speaking Time Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={speakerStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="percentage" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Word Count by Speaker</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={speakerStats}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="words"
                        nameKey="name"
                      >
                        {speakerStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="speakers" className="space-y-6">
            <div className="grid gap-4">
              {speakerStats.map((speaker, index) => (
                <Card key={speaker.name} className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        >
                          {speaker.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{speaker.name}</h3>
                          <p className="text-gray-600">{speaker.segments} segments • {speaker.words} words</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{speaker.percentage}%</p>
                        <p className="text-sm text-gray-500">{speaker.avgConfidence}% accuracy</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${speaker.percentage}%`,
                            backgroundColor: chartColors[index % chartColors.length]
                          }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Timeline Analysis</h3>
                  <p className="text-gray-600 mb-4">Detailed timeline analysis available in Pro plan</p>
                  <Button onClick={handleUpgrade} className="bg-gradient-to-r from-blue-500 to-purple-600">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">AI-Powered Insights</h3>
                  <p className="text-gray-600 mb-4">Get detailed AI analysis and recommendations</p>
                  <Button onClick={handleUpgrade} className="bg-gradient-to-r from-blue-500 to-purple-600">
                    <Crown className="w-4 h-4 mr-2" />
                    Unlock AI Insights
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                Upgrade to Pro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold">₹29.99/month</p>
                <p className="text-gray-600">Unlimited meetings & advanced analytics</p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-green-500" />
                  Unlimited meeting duration
                </li>
                <li className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-blue-500" />
                  Advanced analytics & insights
                </li>
                <li className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-purple-500" />
                  Speaker identification
                </li>
              </ul>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowUpgrade(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleUpgrade} className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600">
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
