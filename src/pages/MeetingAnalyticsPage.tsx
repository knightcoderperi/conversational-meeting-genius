
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PremiumUpgradeModal } from '@/components/ui/premium-upgrade-modal';
import { ArrowLeft, Users, Clock, MessageSquare, TrendingUp, BarChart3, Crown, Zap, Star, Brain, Sparkles, Gem } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 12,
      stiffness: 100
    }
  }
};

export const MeetingAnalyticsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [speakerStats, setSpeakerStats] = useState<SpeakerStats[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

  const chartColors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
  const glowColors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <BarChart3 className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Analytics</h2>
          <p className="text-white/60">Analyzing your meeting data...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.1) 0%, transparent 50%)`
      }}
    >
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Enhanced Header */}
      <motion.header
        className="bg-black/20 backdrop-blur-xl border-b border-white/10 shadow-2xl relative z-10"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <Link 
                to="/" 
                className="flex items-center text-white/80 hover:text-white transition-all duration-300 hover:scale-105 group"
              >
                <motion.div
                  whileHover={{ x: -5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <ArrowLeft className="w-6 h-6 mr-3 group-hover:animate-pulse" />
                </motion.div>
                <span className="text-lg font-medium">Dashboard</span>
              </Link>
              <div className="border-l border-white/20 h-8"></div>
              <div>
                <motion.h1 
                  className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                  animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
                  transition={{ duration: 5, repeat: Infinity }}
                >
                  Meeting Analytics
                </motion.h1>
                <p className="text-white/60 font-medium">
                  {meeting?.title}
                </p>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={() => setShowUpgrade(true)}
                className="relative bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white border-0 hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 px-6 py-3 rounded-xl font-bold overflow-hidden group"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
                <span className="relative z-10 flex items-center">
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade to Pro
                </span>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Tabs defaultValue="overview" className="space-y-8">
            <motion.div variants={itemVariants}>
              <TabsList className="grid w-full grid-cols-4 bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-2">
                {['overview', 'speakers', 'timeline', 'insights'].map((tab, index) => (
                  <TabsTrigger 
                    key={tab}
                    value={tab} 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-white/70 hover:text-white/90 transition-all duration-300 rounded-xl font-medium capitalize"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </motion.div>

            <TabsContent value="overview" className="space-y-8">
              {/* Enhanced Summary Cards */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-4 gap-6"
                variants={containerVariants}
              >
                {[
                  { icon: Clock, label: 'Duration', value: `${Math.floor((meeting?.duration || 0) / 60)}m ${(meeting?.duration || 0) % 60}s`, color: 'from-blue-500 to-cyan-500' },
                  { icon: MessageSquare, label: 'Total Words', value: totalWords.toLocaleString(), color: 'from-green-500 to-emerald-500' },
                  { icon: Users, label: 'Active Speakers', value: speakerStats.length.toString(), color: 'from-purple-500 to-pink-500' },
                  { icon: TrendingUp, label: 'Engagement', value: '94%', color: 'from-orange-500 to-red-500' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, rotateY: 5 }}
                    className="group"
                  >
                    <Card className={`bg-gradient-to-br ${stat.color} text-white border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 relative overflow-hidden`}>
                      <motion.div
                        className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      />
                      <CardContent className="p-8 relative z-10">
                        <div className="flex items-center space-x-4">
                          <motion.div
                            className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                          >
                            <stat.icon className="w-8 h-8" />
                          </motion.div>
                          <div>
                            <p className="text-white/80 text-sm font-medium">{stat.label}</p>
                            <motion.p 
                              className="text-3xl font-bold"
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              {stat.value}
                            </motion.p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {/* Enhanced Charts */}
              <motion.div 
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                variants={containerVariants}
              >
                <motion.div variants={itemVariants}>
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white text-xl font-bold">Speaking Time Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={speakerStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="name" stroke="#fff" />
                          <YAxis stroke="#fff" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.8)', 
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff'
                            }} 
                          />
                          <Bar dataKey="percentage" fill="url(#colorGradient)" radius={[4, 4, 0, 0]} />
                          <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-white text-xl font-bold">Word Count Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={speakerStats}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            dataKey="words"
                            nameKey="name"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth={2}
                          >
                            {speakerStats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={chartColors[index % chartColors.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.8)', 
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              color: '#fff'
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent value="speakers" className="space-y-6">
              <motion.div 
                className="grid gap-6"
                variants={containerVariants}
              >
                {speakerStats.map((speaker, index) => (
                  <motion.div
                    key={speaker.name}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, x: 10 }}
                    className="group"
                  >
                    <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-3xl transition-all duration-500 relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ 
                          background: `linear-gradient(45deg, ${chartColors[index % chartColors.length]}20, transparent)` 
                        }}
                      />
                      <CardContent className="p-8 relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            <motion.div 
                              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl relative"
                              style={{ backgroundColor: chartColors[index % chartColors.length] }}
                              whileHover={{ rotate: 360, scale: 1.1 }}
                              transition={{ duration: 0.5 }}
                            >
                              {speaker.name.charAt(0).toUpperCase()}
                              <motion.div
                                className="absolute inset-0 rounded-full"
                                style={{ 
                                  boxShadow: `0 0 30px ${chartColors[index % chartColors.length]}60` 
                                }}
                                animate={{ 
                                  boxShadow: [
                                    `0 0 30px ${chartColors[index % chartColors.length]}60`,
                                    `0 0 50px ${chartColors[index % chartColors.length]}80`,
                                    `0 0 30px ${chartColors[index % chartColors.length]}60`
                                  ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            </motion.div>
                            <div>
                              <h3 className="text-2xl font-bold text-white mb-2">{speaker.name}</h3>
                              <div className="flex items-center space-x-6 text-white/70">
                                <span className="flex items-center space-x-2">
                                  <MessageSquare className="w-4 h-4" />
                                  <span>{speaker.segments} segments</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <Zap className="w-4 h-4" />
                                  <span>{speaker.words} words</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <Star className="w-4 h-4" />
                                  <span>{speaker.avgConfidence}% accuracy</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <motion.p 
                              className="text-4xl font-bold text-white mb-2"
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 3, repeat: Infinity }}
                            >
                              {speaker.percentage}%
                            </motion.p>
                            <p className="text-white/60">speaking time</p>
                          </div>
                        </div>
                        <div className="mt-6">
                          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                            <motion.div 
                              className="h-3 rounded-full transition-all duration-1000"
                              style={{ 
                                background: `linear-gradient(90deg, ${chartColors[index % chartColors.length]}, ${chartColors[index % chartColors.length]}80)`,
                                width: `${speaker.percentage}%`
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${speaker.percentage}%` }}
                              transition={{ duration: 1, delay: index * 0.2 }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </TabsContent>

            <TabsContent value="timeline">
              <motion.div variants={itemVariants}>
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                  <CardContent className="p-12">
                    <div className="text-center py-16">
                      <motion.div
                        className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-8"
                        animate={{ 
                          rotate: 360,
                          scale: [1, 1.1, 1],
                        }}
                        transition={{ 
                          rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                          scale: { duration: 2, repeat: Infinity }
                        }}
                      >
                        <BarChart3 className="w-12 h-12 text-white" />
                      </motion.div>
                      <motion.h3 
                        className="text-3xl font-bold text-white mb-4"
                        animate={{ opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        Timeline Analysis
                      </motion.h3>
                      <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
                        Detailed timeline analysis with engagement patterns, topic changes, and speaker transitions available in Pro plan
                      </p>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button 
                          onClick={() => setShowUpgrade(true)} 
                          className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white border-0 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 px-8 py-4 text-lg font-bold rounded-xl"
                        >
                          <Crown className="w-5 h-5 mr-2" />
                          Unlock Timeline Analysis
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="insights">
              <motion.div variants={itemVariants}>
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                  <CardContent className="p-12">
                    <div className="text-center py-16">
                      <motion.div
                        className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"
                        animate={{ 
                          rotate: [0, 360],
                          scale: [1, 1.2, 1],
                        }}
                        transition={{ 
                          rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                          scale: { duration: 3, repeat: Infinity }
                        }}
                      >
                        <Brain className="w-12 h-12 text-white" />
                      </motion.div>
                      <motion.h3 
                        className="text-3xl font-bold text-white mb-4"
                        animate={{ opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        AI-Powered Insights
                      </motion.h3>
                      <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
                        Get advanced AI analysis including sentiment analysis, topic clustering, decision tracking, and personalized recommendations
                      </p>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button 
                          onClick={() => setShowUpgrade(true)} 
                          className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white border-0 hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 px-8 py-4 text-lg font-bold rounded-xl"
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Unlock AI Insights
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <PremiumUpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => {
          toast.success('🎉 Welcome to Pro! All features unlocked!');
          setShowUpgrade(false);
        }}
      />
    </div>
  );
};
