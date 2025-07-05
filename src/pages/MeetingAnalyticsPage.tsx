
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
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
  Line
} from 'recharts';

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

interface WordFrequency {
  word: string;
  count: number;
}

interface SpeakerStats {
  speaker: string;
  wordCount: number;
  speakingTime: number;
}

export const MeetingAnalyticsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [wordFrequencies, setWordFrequencies] = useState<WordFrequency[]>([]);
  const [speakerStats, setSpeakerStats] = useState<SpeakerStats[]>([]);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<{ [speaker: string]: number }>({});

  useEffect(() => {
    if (id && user) {
      fetchMeeting();
      fetchTranscriptionSegments();
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

  const fetchTranscriptionSegments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('transcription_segments')
        .select('*')
        .eq('meeting_id', id)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching transcription segments:', error);
        toast.error('Failed to load transcription data');
        return;
      }

      if (data) {
        // Transform database segments to match TranscriptionSegment interface
        const transformedSegments: TranscriptionSegment[] = data.map(segment => ({
          id: segment.id,
          speaker: segment.speaker_name || segment.speaker_id || 'Unknown Speaker',
          text: segment.text,
          confidence: segment.confidence,
          timestamp: new Date(segment.created_at).toLocaleTimeString(),
          isFinal: segment.is_final
        }));

        setTranscriptionSegments(transformedSegments);
        analyzeTranscriptionData(transformedSegments);
      }
    } catch (error) {
      console.error('Error fetching transcription segments:', error);
      toast.error('Failed to load transcription data');
    }
  };

  const analyzeTranscriptionData = (segments: TranscriptionSegment[]) => {
    calculateWordFrequencies(segments);
    calculateSpeakerStats(segments);
    performSentimentAnalysis(segments);
  };

  const calculateWordFrequencies = (segments: TranscriptionSegment[]) => {
    const wordCounts: { [word: string]: number } = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'about', 'as', 'if', 'then', 'so', 'that', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'may', 'might', 'must', 'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs']);

    segments.forEach(segment => {
      const words = segment.text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        const cleanedWord = word.replace(/[^a-z]/g, '');
        if (cleanedWord && !stopWords.has(cleanedWord)) {
          wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
        }
      });
    });

    const sortedFrequencies = Object.entries(wordCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    setWordFrequencies(sortedFrequencies);
  };

  const calculateSpeakerStats = (segments: TranscriptionSegment[]) => {
    const speakerWordCounts: { [speaker: string]: number } = {};
    const speakerSpeakingTimes: { [speaker: string]: number } = {};

    segments.forEach(segment => {
      speakerWordCounts[segment.speaker] = (speakerWordCounts[segment.speaker] || 0) + segment.text.split(/\s+/).length;
      speakerSpeakingTimes[segment.speaker] = (speakerSpeakingTimes[segment.speaker] || 0) + segment.text.length;
    });

    const calculatedSpeakerStats = Object.entries(speakerWordCounts).map(([speaker, wordCount]) => ({
      speaker,
      wordCount,
      speakingTime: speakerSpeakingTimes[speaker] || 0
    }));

    setSpeakerStats(calculatedSpeakerStats);
  };

  const performSentimentAnalysis = (segments: TranscriptionSegment[]) => {
    // Mock sentiment analysis - replace with actual API call or library
    const mockSentimentScores: { [speaker: string]: number } = {};
    segments.forEach(segment => {
      // Assign a random sentiment score for each speaker
      mockSentimentScores[segment.speaker] = Math.random() * 2 - 1; // Score between -1 and 1
    });
    setSentimentAnalysis(mockSentimentScores);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2,
        duration: 0.8,
        ease: [0.6, -0.05, 0.01, 0.99] as const,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.6, -0.05, 0.01, 0.99] as const,
      },
    },
  };

  const chartVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.7,
        ease: [0.6, -0.05, 0.01, 0.99] as const,
      },
    },
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Enhanced Header */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center text-purple-300 hover:text-purple-100 transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
              <div className="border-l border-purple-500/30 h-6"></div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {meeting.title} - Analytics
                </h1>
                <p className="text-sm text-purple-300 capitalize">
                  {meeting.platform} Meeting
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Word Frequency Analysis */}
          <motion.div 
            className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-2xl rounded-xl p-6" 
            variants={itemVariants}
          >
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-3 animate-pulse"></div>
              Top Word Frequencies
            </h2>
            <motion.div variants={chartVariants}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={wordFrequencies}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="word" 
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
                      color: '#ffffff',
                      border: '1px solid #7C3AED',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Bar 
                    dataKey="count" 
                    fill="url(#purpleGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>

          {/* Speaker Statistics */}
          <motion.div 
            className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-2xl rounded-xl p-6" 
            variants={itemVariants}
          >
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3 animate-pulse"></div>
              Speaker Distribution
            </h2>
            <motion.div variants={chartVariants}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    dataKey="wordCount"
                    isAnimationActive={true}
                    data={speakerStats}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ speaker, percent }) => `${speaker}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {speakerStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                      color: '#ffffff',
                      border: '1px solid #10B981',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>

          {/* Speaking Time Analysis */}
          <motion.div 
            className="bg-black/40 backdrop-blur-xl border border-purple-500/20 shadow-2xl rounded-xl p-6" 
            variants={itemVariants}
          >
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-3 animate-pulse"></div>
              Speaking Engagement
            </h2>
            <motion.div variants={chartVariants}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={speakerStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="speaker" 
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
                      color: '#ffffff',
                      border: '1px solid #F59E0B',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Bar 
                    dataKey="wordCount" 
                    fill="url(#orangeGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#D97706" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>
        </div>

        {/* Summary Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8"
          variants={containerVariants}
        >
          <motion.div 
            className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-xl p-6 text-center"
            variants={itemVariants}
          >
            <h3 className="text-2xl font-bold text-white">{transcriptionSegments.length}</h3>
            <p className="text-purple-300">Total Segments</p>
          </motion.div>
          
          <motion.div 
            className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-6 text-center"
            variants={itemVariants}
          >
            <h3 className="text-2xl font-bold text-white">{speakerStats.length}</h3>
            <p className="text-emerald-300">Speakers Detected</p>
          </motion.div>
          
          <motion.div 
            className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-xl border border-orange-500/30 rounded-xl p-6 text-center"
            variants={itemVariants}
          >
            <h3 className="text-2xl font-bold text-white">
              {speakerStats.reduce((sum, speaker) => sum + speaker.wordCount, 0)}
            </h3>
            <p className="text-orange-300">Total Words</p>
          </motion.div>
          
          <motion.div 
            className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-xl border border-blue-500/30 rounded-xl p-6 text-center"
            variants={itemVariants}
          >
            <h3 className="text-2xl font-bold text-white">
              {Math.round(transcriptionSegments.reduce((sum, seg) => sum + seg.confidence, 0) / transcriptionSegments.length * 100) || 0}%
            </h3>
            <p className="text-blue-300">Avg Confidence</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};
