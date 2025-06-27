
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, MessageSquare, TrendingUp } from 'lucide-react';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface LiveMeetingAnalyticsProps {
  meetingId: string | null;
  transcriptionSegments: TranscriptionSegment[];
  isRecording: boolean;
  startTime?: number;
}

interface SpeakerAnalytics {
  name: string;
  segments: number;
  words: number;
  percentage: number;
  averageConfidence: number;
}

export const LiveMeetingAnalytics: React.FC<LiveMeetingAnalyticsProps> = ({
  meetingId,
  transcriptionSegments,
  isRecording,
  startTime = Date.now()
}) => {
  const [analytics, setAnalytics] = useState({
    speakers: [] as SpeakerAnalytics[],
    totalDuration: 0,
    totalWords: 0,
    totalSegments: 0,
    averageConfidence: 0,
    keyTopics: [] as string[]
  });

  useEffect(() => {
    if (transcriptionSegments.length > 0) {
      calculateAnalytics();
    }
  }, [transcriptionSegments]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setAnalytics(prev => ({
          ...prev,
          totalDuration: Math.floor((Date.now() - startTime) / 1000)
        }));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRecording, startTime]);

  const calculateAnalytics = () => {
    const finalSegments = transcriptionSegments.filter(segment => segment.isFinal);
    
    if (finalSegments.length === 0) {
      return;
    }

    // Calculate speaker statistics
    const speakerStats: { [key: string]: { segments: number; words: number; confidenceSum: number } } = {};
    let totalWords = 0;
    let totalConfidence = 0;
    const allWords: string[] = [];

    finalSegments.forEach(segment => {
      if (!speakerStats[segment.speaker]) {
        speakerStats[segment.speaker] = { segments: 0, words: 0, confidenceSum: 0 };
      }

      const words = segment.text.trim().split(/\s+/).filter(word => word.length > 0);
      speakerStats[segment.speaker].segments += 1;
      speakerStats[segment.speaker].words += words.length;
      speakerStats[segment.speaker].confidenceSum += segment.confidence;
      
      totalWords += words.length;
      totalConfidence += segment.confidence;
      allWords.push(...words);
    });

    // Convert to analytics format
    const speakers = Object.entries(speakerStats).map(([name, stats]) => ({
      name,
      segments: stats.segments,
      words: stats.words,
      percentage: Math.round((stats.words / totalWords) * 100),
      averageConfidence: Math.round((stats.confidenceSum / stats.segments) * 100)
    })).sort((a, b) => b.words - a.words);

    // Extract key topics
    const keyTopics = extractKeyTopics(allWords);

    setAnalytics({
      speakers,
      totalDuration: Math.floor((Date.now() - startTime) / 1000),
      totalWords,
      totalSegments: finalSegments.length,
      averageConfidence: Math.round((totalConfidence / finalSegments.length) * 100),
      keyTopics
    });
  };

  const extractKeyTopics = (words: string[]): string[] => {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'ought', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their']);
    
    const wordCounts: { [key: string]: number } = {};
    
    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
      }
    });

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (index: number) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
              <p className="text-lg font-bold text-blue-600">
                {formatDuration(analytics.totalDuration)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Words</p>
              <p className="text-lg font-bold text-green-600">
                {analytics.totalWords.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Speakers</p>
              <p className="text-lg font-bold text-purple-600">
                {analytics.speakers.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
              <p className="text-lg font-bold text-orange-600">
                {analytics.averageConfidence}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Speaker Distribution */}
      {analytics.speakers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Speaker Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.speakers.map((speaker, index) => (
              <div key={speaker.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full bg-${getSpeakerColor(index)}-500`}></div>
                    <span className="font-medium">{speaker.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {speaker.segments} segments
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{speaker.percentage}%</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({speaker.words} words)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`bg-${getSpeakerColor(index)}-500 h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${speaker.percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Accuracy: {speaker.averageConfidence}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Topics */}
      {analytics.keyTopics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Key Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.keyTopics.map((topic, index) => (
                <Badge 
                  key={index}
                  variant="secondary" 
                  className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Status */}
      {isRecording && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Live Analytics • Updates every few seconds
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics.speakers.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Analytics Loading
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {isRecording 
                ? 'Speak to see real-time analytics' 
                : 'Start recording to see meeting analytics'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
