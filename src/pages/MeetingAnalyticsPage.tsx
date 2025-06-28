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
} from 'recharts';
import {
  PieChart,
  Pie,
  Cell,
  Sector
} from 'recharts';
import {
  LineChart,
  Line,
  Label,
  LabelList
} from 'recharts';
import {
  AreaChart,
  Area
} from 'recharts';
import {
  ScatterChart,
  Scatter
} from 'recharts';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  ComposedChart,
} from 'recharts';
import {
  Treemap,
} from 'recharts';
import {
  FunnelChart,
  Funnel,
  Label as FunnelLabel
} from 'recharts';
import {
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  Brush,
} from 'recharts';
import {
  ReferenceLine,
  ReferenceArea,
  ReferenceDot
} from 'recharts';
import {
  ErrorBar,
} from 'recharts';
import {
  CustomShape,
} from 'recharts';
import {
  Crosshair,
} from 'recharts';
import {
  Legend as CustomizedLegend,
} from 'recharts';
import {
  Tooltip as CustomizedTooltip,
} from 'recharts';
import {
  Customized,
} from 'recharts';
import {
  Text,
} from 'recharts';
import {
  Rectangle,
} from 'recharts';
import {
  Triangle,
} from 'recharts';
import {
  Sector as CustomizedSector,
} from 'recharts';
import {
  Curve,
} from 'recharts';
import {
  Dot,
} from 'recharts';
import {
  Symbol,
} from 'recharts';
import {
  Surface,
} from 'recharts';
import {
  Layer,
} from 'recharts';
import {
  Cell as CustomizedCell,
} from 'recharts';
import {
  ReferenceLine as CustomizedReferenceLine,
} from 'recharts';
import {
  ReferenceArea as CustomizedReferenceArea,
} from 'recharts';
import {
  ReferenceDot as CustomizedReferenceDot,
} from 'recharts';
import {
  ErrorBar as CustomizedErrorBar,
} from 'recharts';
import {
  CustomShape as CustomizedCustomShape,
} from 'recharts';
import {
  Crosshair as CustomizedCrosshair,
} from 'recharts';
import {
  Text as CustomizedText,
} from 'recharts';
import {
  Rectangle as CustomizedRectangle,
} from 'recharts';
import {
  Triangle as CustomizedTriangle,
} from 'recharts';
import {
  Curve as CustomizedCurve,
} from 'recharts';
import {
  Dot as CustomizedDot,
} from 'recharts';
import {
  Symbol as CustomizedSymbol,
} from 'recharts';
import {
  Surface as CustomizedSurface,
} from 'recharts';
import {
  Layer as CustomizedLayer,
} from 'recharts';
import {
  ResponsiveContainer as CustomizedResponsiveContainer,
} from 'recharts';
import {
  BarChart as CustomizedBarChart,
} from 'recharts';
import {
  PieChart as CustomizedPieChart,
} from 'recharts';
import {
  LineChart as CustomizedLineChart,
} from 'recharts';
import {
  AreaChart as CustomizedAreaChart,
} from 'recharts';
import {
  ScatterChart as CustomizedScatterChart,
} from 'recharts';
import {
  RadarChart as CustomizedRadarChart,
} from 'recharts';
import {
  ComposedChart as CustomizedComposedChart,
} from 'recharts';
import {
  Treemap as CustomizedTreemap,
} from 'recharts';
import {
  FunnelChart as CustomizedFunnelChart,
} from 'recharts';
import {
  RadialBarChart as CustomizedRadialBarChart,
} from 'recharts';
import {
  Brush as CustomizedBrush,
} from 'recharts';
import {
  Bar as CustomizedBar,
} from 'recharts';
import {
  Pie as CustomizedPie,
} from 'recharts';
import {
  Line as CustomizedLine,
} from 'recharts';
import {
  Area as CustomizedArea,
} from 'recharts';
import {
  Scatter as CustomizedScatter,
} from 'recharts';
import {
  Radar as CustomizedRadar,
} from 'recharts';
import {
  Funnel as CustomizedFunnel,
} from 'recharts';
import {
  RadialBar as CustomizedRadialBar,
} from 'recharts';
import {
  XAxis as CustomizedXAxis,
} from 'recharts';
import {
  YAxis as CustomizedYAxis,
} from 'recharts';
import {
  CartesianGrid as CustomizedCartesianGrid,
} from 'recharts';
import {
  Tooltip as CustomizedRechartsTooltip,
} from 'recharts';
import {
  Legend as CustomizedRechartsLegend,
} from 'recharts';
import {
  Label as CustomizedRechartsLabel,
} from 'recharts';
import {
  LabelList as CustomizedRechartsLabelList,
} from 'recharts';
import {
  FunnelLabel as CustomizedFunnelLabel,
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
        setTranscriptionSegments(data);
        analyzeTranscriptionData(data);
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
        ease: "easeInOut",
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
        ease: "easeOut",
      },
    },
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const data01 = [
    { name: 'Group A', value: 400 },
    { name: 'Group B', value: 300 },
    { name: 'Group C', value: 300 },
    { name: 'Group D', value: 200 },
  ];

  const data02 = [
    { name: 'A1', value: 100 },
    { name: 'A2', value: 140 },
    { name: 'B1', value: 150 },
    { name: 'B2', value: 110 },
    { name: 'B3', value: 80 },
    { name: 'B4', value: 120 },
    { name: 'C1', value: 100 },
    { name: 'C2', value: 150 },
    { name: 'D1', value: 110 },
    { name: 'D2', value: 90 },
  ];

  const animationVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 1,
        delay: 0.5,
        ease: [0, 0.71, 0.2, 1.01]
      }
    }
  };

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
                  {meeting.title} - Analytics
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
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
          <motion.div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4" variants={itemVariants}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Top 20 Word Frequencies
            </h2>
            <motion.div variants={chartVariants}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={wordFrequencies}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="word" tick={{ fill: '#6B7280' }} />
                  <YAxis tick={{ fill: '#6B7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#E5E7EB', color: '#111827' }} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>

          {/* Speaker Statistics */}
          <motion.div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4" variants={itemVariants}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Speaker Statistics
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
                    label
                  >
                    {speakerStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#E5E7EB', color: '#111827' }} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>

          {/* Sentiment Analysis (Mock Data) */}
          <motion.div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4" variants={itemVariants}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Sentiment Analysis (Mock)
            </h2>
            <motion.div variants={chartVariants}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={speakerStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="speaker" tick={{ fill: '#6B7280' }} />
                  <YAxis tick={{ fill: '#6B7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#E5E7EB', color: '#111827' }} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Bar dataKey="wordCount" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
