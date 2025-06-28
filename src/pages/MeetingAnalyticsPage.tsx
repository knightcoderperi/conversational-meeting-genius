
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PremiumUpgradeModal } from '@/components/ui/premium-upgrade-modal';
import { ArrowLeft, Users, Clock, MessageSquare, TrendingUp, BarChart3, Crown, Zap, Star, Brain, Sparkles, Gem, Eye, Target, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, RadialBarChart, RadialBar } from 'recharts';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
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
      delayChildren: 0.2,
      staggerChildren: 0.15,
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const itemVariants = {
  hidden: { 
    y: 100, 
    opacity: 0,
    rotateX: -15,
    scale: 0.9
  },
  visible: {
    y: 0,
    opacity: 1,
    rotateX: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      damping: 25,
      stiffness: 120,
      mass: 1.2
    }
  }
};

const magneticVariants = {
  rest: { scale: 1, rotateZ: 0 },
  hover: { 
    scale: 1.05, 
    rotateZ: 2,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 17
    }
  },
  tap: { 
    scale: 0.95,
    rotateZ: -1,
    transition: {
      type: "spring" as const,
      stiffness: 600,
      damping: 20
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
  
  // Premium cursor tracking and particle system
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cursorX = useSpring(mouseX, { stiffness: 500, damping: 28 });
  const cursorY = useSpring(mouseY, { stiffness: 500, damping: 28 });
  
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    opacity: number;
    size: number;
    color: string;
  }>>([]);

  // Initialize magical particle system
  useEffect(() => {
    const particleColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      opacity: Math.random() * 0.6 + 0.2,
      size: Math.random() * 3 + 1,
      color: particleColors[Math.floor(Math.random() * particleColors.length)]
    }));
    setParticles(newParticles);

    // Animate particles
    const interval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vx: particle.x > window.innerWidth || particle.x < 0 ? -particle.vx : particle.vx,
        vy: particle.y > window.innerHeight || particle.y < 0 ? -particle.vy : particle.vy,
        opacity: Math.sin(Date.now() * 0.001 + particle.id) * 0.3 + 0.4
      })));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Enhanced mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

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

  const chartColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
  const premiumGradients = [
    'from-blue-500 via-purple-500 to-pink-500',
    'from-green-500 via-emerald-500 to-teal-500',
    'from-orange-500 via-red-500 to-pink-500',
    'from-purple-500 via-indigo-500 to-blue-500',
    'from-pink-500 via-rose-500 to-red-500',
    'from-cyan-500 via-blue-500 to-indigo-500'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Cosmic background */}
        <div className="absolute inset-0">
          {Array.from({ length: 100 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, scale: 0.5, rotateY: -180 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ 
            type: "spring" as const, 
            damping: 25, 
            stiffness: 120,
            duration: 1.2 
          }}
        >
          <motion.div
            className="w-32 h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-8 relative"
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity }
            }}
          >
            <BarChart3 className="w-16 h-16 text-white" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full blur-xl opacity-60"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.6, 0.9, 0.6]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
          <motion.h2 
            className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4"
            animate={{ 
              backgroundPosition: ["0%", "100%", "0%"],
              scale: [1, 1.02, 1]
            }}
            transition={{ 
              backgroundPosition: { duration: 3, repeat: Infinity },
              scale: { duration: 2, repeat: Infinity }
            }}
          >
            🚀 Analyzing Your Meeting
          </motion.h2>
          <motion.p 
            className="text-white/70 text-xl"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Extracting insights with AI precision...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      {/* Premium particle system */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full blur-sm"
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              left: particle.x,
              top: particle.y,
              opacity: particle.opacity,
            }}
            animate={{
              scale: [1, 1.5, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Dynamic cursor trail */}
      <motion.div
        className="fixed w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full pointer-events-none z-50 mix-blend-difference"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%'
        }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Holographic header */}
      <motion.header
        className="bg-black/30 backdrop-blur-2xl border-b border-white/20 shadow-2xl relative z-10"
        initial={{ y: -100, opacity: 0, rotateX: -90 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ 
          type: "spring" as const, 
          damping: 30, 
          stiffness: 100,
          duration: 1
        }}
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(99,102,241,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent) 1'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <motion.div
                variants={magneticVariants}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
              >
                <Link 
                  to="/" 
                  className="flex items-center text-white/80 hover:text-white transition-all duration-300 group"
                >
                  <motion.div
                    whileHover={{ x: -8, rotate: -10 }}
                    transition={{ type: "spring" as const, stiffness: 400, damping: 17 }}
                  >
                    <ArrowLeft className="w-6 h-6 mr-3 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  </motion.div>
                  <span className="text-lg font-medium">Dashboard</span>
                </Link>
              </motion.div>
              <div className="border-l border-white/30 h-8"></div>
              <div>
                <motion.h1 
                  className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                  animate={{ 
                    backgroundPosition: ["0%", "100%", "0%"],
                    textShadow: [
                      "0 0 20px rgba(59,130,246,0.5)",
                      "0 0 40px rgba(139,92,246,0.8)",
                      "0 0 20px rgba(59,130,246,0.5)"
                    ]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  🎯 Meeting Analytics
                </motion.h1>
                <motion.p 
                  className="text-white/70 font-medium text-lg"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {meeting?.title}
                </motion.p>
              </div>
            </div>
            <motion.div
              variants={magneticVariants}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                onClick={() => setShowUpgrade(true)}
                className="relative bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white border-0 hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-500 px-8 py-4 rounded-2xl font-bold overflow-hidden group text-lg"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                />
                <span className="relative z-10 flex items-center">
                  <Crown className="w-6 h-6 mr-2" />
                  ✨ Upgrade to Pro
                </span>
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-2xl"
                  animate={{ 
                    x: ["-100%", "100%"],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
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
              <TabsList className="grid w-full grid-cols-4 bg-black/30 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 shadow-2xl">
                {['overview', 'speakers', 'timeline', 'insights'].map((tab, index) => (
                  <motion.div
                    key={tab}
                    variants={magneticVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <TabsTrigger 
                      value={tab} 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white text-white/70 hover:text-white/90 transition-all duration-300 rounded-2xl font-medium capitalize text-lg py-3 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/25"
                    >
                      {tab}
                    </TabsTrigger>
                  </motion.div>
                ))}
              </TabsList>
            </motion.div>

            <TabsContent value="overview" className="space-y-8">
              {/* Ultra-premium summary cards */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                variants={containerVariants}
              >
                {[
                  { icon: Clock, label: '⏱️ Duration', value: `${Math.floor((meeting?.duration || 0) / 60)}m ${(meeting?.duration || 0) % 60}s`, gradient: premiumGradients[0], color: '#3b82f6' },
                  { icon: MessageSquare, label: '💬 Total Words', value: totalWords.toLocaleString(), gradient: premiumGradients[1], color: '#10b981' },
                  { icon: Users, label: '👥 Active Speakers', value: speakerStats.length.toString(), gradient: premiumGradients[2], color: '#8b5cf6' },
                  { icon: TrendingUp, label: '📈 Engagement', value: '94%', gradient: premiumGradients[3], color: '#f59e0b' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    variants={itemVariants}
                    whileHover={{ 
                      scale: 1.05, 
                      rotateY: 5,
                      z: 50
                    }}
                    className="group cursor-pointer"
                  >
                    <Card className={`bg-gradient-to-br ${stat.gradient} text-white border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 relative overflow-hidden backdrop-blur-xl`}>
                      {/* Holographic overlay */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        animate={{ 
                          background: [
                            'linear-gradient(45deg, rgba(255,255,255,0.2), transparent, rgba(255,255,255,0.1))',
                            'linear-gradient(135deg, rgba(255,255,255,0.1), transparent, rgba(255,255,255,0.2))',
                            'linear-gradient(225deg, rgba(255,255,255,0.2), transparent, rgba(255,255,255,0.1))'
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                      
                      {/* Particle effects */}
                      <div className="absolute inset-0 overflow-hidden">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-white/50 rounded-full"
                            style={{
                              left: `${20 + i * 15}%`,
                              top: `${20 + i * 10}%`,
                            }}
                            animate={{
                              y: [0, -20, 0],
                              opacity: [0, 1, 0],
                              scale: [0, 1, 0]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.3
                            }}
                          />
                        ))}
                      </div>

                      <CardContent className="p-8 relative z-10">
                        <div className="flex items-center space-x-6">
                          <motion.div
                            className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/30"
                            whileHover={{ 
                              rotate: 360,
                              scale: 1.1
                            }}
                            transition={{ 
                              rotate: { duration: 0.6 },
                              scale: { duration: 0.3 }
                            }}
                            style={{
                              boxShadow: `0 0 30px ${stat.color}40`
                            }}
                          >
                            <stat.icon className="w-10 h-10" />
                            <motion.div
                              className="absolute inset-0 rounded-3xl"
                              animate={{ 
                                boxShadow: [
                                  `0 0 20px ${stat.color}40`,
                                  `0 0 40px ${stat.color}80`,
                                  `0 0 20px ${stat.color}40`
                                ]
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          </motion.div>
                          <div>
                            <p className="text-white/90 text-sm font-medium mb-2">{stat.label}</p>
                            <motion.p 
                              className="text-4xl font-bold"
                              animate={{ 
                                scale: [1, 1.05, 1],
                                textShadow: [
                                  "0 0 10px rgba(255,255,255,0.5)",
                                  "0 0 20px rgba(255,255,255,0.8)",
                                  "0 0 10px rgba(255,255,255,0.5)"
                                ]
                              }}
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

              {/* Revolutionary charts section */}
              <motion.div 
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                variants={containerVariants}
              >
                <motion.div variants={itemVariants}>
                  <Card className="bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-50"
                      animate={{
                        background: [
                          'linear-gradient(45deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1), rgba(236,72,153,0.1))',
                          'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1), rgba(59,130,246,0.1))',
                          'linear-gradient(225deg, rgba(236,72,153,0.1), rgba(59,130,246,0.1), rgba(139,92,246,0.1))'
                        ]
                      }}
                      transition={{ duration: 8, repeat: Infinity }}
                    />
                    <CardHeader className="relative z-10">
                      <CardTitle className="text-white text-2xl font-bold flex items-center">
                        <BarChart3 className="w-6 h-6 mr-3 text-blue-400" />
                        🎯 Speaking Time Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={speakerStats}>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="50%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="name" stroke="#fff" fontSize={12} />
                          <YAxis stroke="#fff" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.9)', 
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '12px',
                              color: '#fff',
                              backdropFilter: 'blur(20px)'
                            }} 
                          />
                          <Bar 
                            dataKey="percentage" 
                            fill="url(#barGradient)" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 opacity-50"
                      animate={{
                        background: [
                          'linear-gradient(45deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1), rgba(20,184,166,0.1))',
                          'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(20,184,166,0.1), rgba(34,197,94,0.1))',
                          'linear-gradient(225deg, rgba(20,184,166,0.1), rgba(34,197,94,0.1), rgba(16,185,129,0.1))'
                        ]
                      }}
                      transition={{ duration: 8, repeat: Infinity }}
                    />
                    <CardHeader className="relative z-10">
                      <CardTitle className="text-white text-2xl font-bold flex items-center">
                        <Activity className="w-6 h-6 mr-3 text-emerald-400" />
                        💬 Word Count Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <defs>
                            {chartColors.map((color, index) => (
                              <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={color} />
                                <stop offset="100%" stopColor={`${color}80`} />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie
                            data={speakerStats}
                            cx="50%"
                            cy="50%"
                            outerRadius={140}
                            dataKey="words"
                            nameKey="name"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth={3}
                          >
                            {speakerStats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#pieGradient${index % chartColors.length})`}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.9)', 
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '12px',
                              color: '#fff',
                              backdropFilter: 'blur(20px)'
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
                    whileHover={{ 
                      scale: 1.02, 
                      x: 10,
                      rotateY: 2
                    }}
                    className="group cursor-pointer"
                  >
                    <Card className="bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl hover:shadow-3xl transition-all duration-500 relative overflow-hidden">
                      {/* Dynamic background based on speaker */}
                      <motion.div
                        className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500"
                        style={{ 
                          background: `linear-gradient(135deg, ${chartColors[index % chartColors.length]}20, transparent, ${chartColors[index % chartColors.length]}10)` 
                        }}
                        animate={{
                          background: [
                            `linear-gradient(45deg, ${chartColors[index % chartColors.length]}20, transparent)`,
                            `linear-gradient(135deg, ${chartColors[index % chartColors.length]}30, transparent)`,
                            `linear-gradient(225deg, ${chartColors[index % chartColors.length]}20, transparent)`
                          ]
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                      />
                      
                      <CardContent className="p-8 relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            <motion.div 
                              className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl relative"
                              style={{ backgroundColor: chartColors[index % chartColors.length] }}
                              whileHover={{ 
                                rotate: 360, 
                                scale: 1.1,
                                boxShadow: `0 0 30px ${chartColors[index % chartColors.length]}80`
                              }}
                              transition={{ duration: 0.5 }}
                            >
                              {speaker.name.charAt(0).toUpperCase()}
                              <motion.div
                                className="absolute inset-0 rounded-full"
                                animate={{ 
                                  boxShadow: [
                                    `0 0 20px ${chartColors[index % chartColors.length]}40`,
                                    `0 0 40px ${chartColors[index % chartColors.length]}80`,
                                    `0 0 20px ${chartColors[index % chartColors.length]}40`
                                  ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                              {/* Orbital rings */}
                              <motion.div
                                className="absolute w-24 h-24 border border-white/20 rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                              />
                            </motion.div>
                            <div>
                              <motion.h3 
                                className="text-3xl font-bold text-white mb-3"
                                animate={{
                                  textShadow: [
                                    "0 0 10px rgba(255,255,255,0.5)",
                                    "0 0 20px rgba(255,255,255,0.8)",
                                    "0 0 10px rgba(255,255,255,0.5)"
                                  ]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                              >
                                {speaker.name}
                              </motion.h3>
                              <div className="flex items-center space-x-6 text-white/80">
                                <span className="flex items-center space-x-2">
                                  <MessageSquare className="w-5 h-5 text-blue-400" />
                                  <span className="text-lg">{speaker.segments} segments</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <Zap className="w-5 h-5 text-yellow-400" />
                                  <span className="text-lg">{speaker.words} words</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <Target className="w-5 h-5 text-green-400" />
                                  <span className="text-lg">{speaker.avgConfidence}% accuracy</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <motion.p 
                              className="text-5xl font-bold text-white mb-2"
                              animate={{ 
                                scale: [1, 1.1, 1],
                                textShadow: [
                                  "0 0 20px rgba(255,255,255,0.5)",
                                  "0 0 40px rgba(255,255,255,0.8)",
                                  "0 0 20px rgba(255,255,255,0.5)"
                                ]
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            >
                              {speaker.percentage}%
                            </motion.p>
                            <p className="text-white/70 text-lg">speaking time</p>
                          </div>
                        </div>
                        
                        {/* Enhanced progress bar */}
                        <div className="mt-8">
                          <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                            <motion.div 
                              className="h-4 rounded-full relative overflow-hidden"
                              style={{ 
                                background: `linear-gradient(90deg, ${chartColors[index % chartColors.length]}, ${chartColors[index % chartColors.length]}80, ${chartColors[index % chartColors.length]})`
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${speaker.percentage}%` }}
                              transition={{ 
                                duration: 1.5, 
                                delay: index * 0.2,
                                ease: "easeOut"
                              }}
                            >
                              {/* Animated shine effect */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ 
                                  duration: 2, 
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                            </motion.div>
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
                <Card className="bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"
                    animate={{
                      background: [
                        'linear-gradient(45deg, rgba(59,130,246,0.05), rgba(139,92,246,0.05), rgba(236,72,153,0.05))',
                        'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(236,72,153,0.05), rgba(59,130,246,0.05))',
                        'linear-gradient(225deg, rgba(236,72,153,0.05), rgba(59,130,246,0.05), rgba(139,92,246,0.05))'
                      ]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  />
                  <CardContent className="p-16 relative z-10">
                    <div className="text-center py-16">
                      <motion.div
                        className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-12 relative"
                        animate={{ 
                          rotate: 360,
                          scale: [1, 1.2, 1],
                        }}
                        transition={{ 
                          rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                          scale: { duration: 3, repeat: Infinity }
                        }}
                      >
                        <BarChart3 className="w-16 h-16 text-white" />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-2xl opacity-50"
                          animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0.8, 0.5]
                          }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                        {/* Orbital rings */}
                        {Array.from({ length: 3 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className={`absolute border border-white/20 rounded-full`}
                            style={{
                              width: `${140 + i * 20}px`,
                              height: `${140 + i * 20}px`
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ 
                              duration: 10 + i * 2, 
                              repeat: Infinity, 
                              ease: "linear",
                              direction: i % 2 ? "reverse" : "normal"
                            }}
                          />
                        ))}
                      </motion.div>
                      <motion.h3 
                        className="text-4xl font-bold text-white mb-6"
                        animate={{ 
                          opacity: [0.8, 1, 0.8],
                          scale: [1, 1.02, 1]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        🚀 Timeline Analysis
                      </motion.h3>
                      <motion.p 
                        className="text-white/70 text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
                        animate={{ opacity: [0.7, 0.9, 0.7] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        Advanced timeline analysis with engagement patterns, topic transitions, emotional flow, and speaker interaction dynamics - available with Pro plan
                      </motion.p>
                      <motion.div
                        variants={magneticVariants}
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Button 
                          onClick={() => setShowUpgrade(true)} 
                          className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white border-0 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 px-12 py-6 text-xl font-bold rounded-3xl relative overflow-hidden group"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            animate={{ 
                              background: [
                                'linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899)',
                                'linear-gradient(135deg, #8b5cf6, #ec4899, #3b82f6)',
                                'linear-gradient(225deg, #ec4899, #3b82f6, #8b5cf6)'
                              ]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                          />
                          <span className="relative z-10 flex items-center">
                            <Crown className="w-6 h-6 mr-3" />
                            ✨ Unlock Timeline Magic
                          </span>
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="insights">
              <motion.div variants={itemVariants}>
                <Card className="bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5"
                    animate={{
                      background: [
                        'linear-gradient(45deg, rgba(34,197,94,0.05), rgba(16,185,129,0.05), rgba(20,184,166,0.05))',
                        'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(20,184,166,0.05), rgba(34,197,94,0.05))',
                        'linear-gradient(225deg, rgba(20,184,166,0.05), rgba(34,197,94,0.05), rgba(16,185,129,0.05))'
                      ]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  />
                  <CardContent className="p-16 relative z-10">
                    <div className="text-center py-16">
                      <motion.div
                        className="w-32 h-32 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-12 relative"
                        animate={{ 
                          rotate: [0, 360],
                          scale: [1, 1.3, 1],
                        }}
                        transition={{ 
                          rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                          scale: { duration: 4, repeat: Infinity }
                        }}
                      >
                        <Brain className="w-16 h-16 text-white" />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full blur-2xl opacity-60"
                          animate={{ 
                            scale: [1, 1.6, 1],
                            opacity: [0.6, 0.9, 0.6]
                          }}
                          transition={{ duration: 4, repeat: Infinity }}
                        />
                        {/* Neural network visualization */}
                        {Array.from({ length: 8 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-white/60 rounded-full"
                            style={{
                              left: `${50 + 30 * Math.cos(i * Math.PI / 4)}%`,
                              top: `${50 + 30 * Math.sin(i * Math.PI / 4)}%`,
                            }}
                            animate={{
                              scale: [0, 1, 0],
                              opacity: [0, 1, 0]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.2
                            }}
                          />
                        ))}
                      </motion.div>
                      <motion.h3 
                        className="text-4xl font-bold text-white mb-6"
                        animate={{ 
                          opacity: [0.8, 1, 0.8],
                          scale: [1, 1.02, 1]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        🧠 AI-Powered Insights
                      </motion.h3>
                      <motion.p 
                        className="text-white/70 text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
                        animate={{ opacity: [0.7, 0.9, 0.7] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        Revolutionary AI analysis including sentiment tracking, topic clustering, decision identification, engagement scoring, and personalized recommendations powered by advanced machine learning
                      </motion.p>
                      <motion.div
                        variants={magneticVariants}
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Button 
                          onClick={() => setShowUpgrade(true)} 
                          className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white border-0 hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-500 px-12 py-6 text-xl font-bold rounded-3xl relative overflow-hidden group"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            animate={{ 
                              background: [
                                'linear-gradient(45deg, #10b981, #059669, #0d9488)',
                                'linear-gradient(135deg, #059669, #0d9488, #10b981)',
                                'linear-gradient(225deg, #0d9488, #10b981, #059669)'
                              ]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                          />
                          <span className="relative z-10 flex items-center">
                            <Sparkles className="w-6 h-6 mr-3" />
                            🚀 Unlock AI Insights
                          </span>
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
          toast.success('🎉 Welcome to Pro! All premium features unlocked!');
          setShowUpgrade(false);
        }}
      />
    </div>
  );
};
