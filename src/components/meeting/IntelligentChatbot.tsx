
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Bot, User, Brain, Clock, MessageSquare, Search, Lightbulb, BarChart3, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  startTime: number;
  speakerName: string;
  isFinal: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'meeting' | 'general' | 'time-based' | 'analysis';
  relevantSegments?: TranscriptionSegment[];
}

interface QueryAnalysis {
  type: 'MEETING_SPECIFIC' | 'GENERAL_KNOWLEDGE' | 'TIME_BASED' | 'SPEAKER_SPECIFIC' | 'HYBRID';
  timeRange?: string;
  speakerMentioned?: string;
  keywords: string[];
  intent: 'summary' | 'question' | 'analysis' | 'search';
  needsMeetingData: boolean;
}

interface IntelligentChatbotProps {
  meetingId: string | null;
  transcriptionHistory: TranscriptionSegment[];
}

export const IntelligentChatbot: React.FC<IntelligentChatbotProps> = ({
  meetingId,
  transcriptionHistory
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextIndex, setContextIndex] = useState<Map<string, any>>(new Map());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Quick action suggestions based on meeting context
  const getSmartSuggestions = () => {
    const speakers = Array.from(new Set(transcriptionHistory.map(s => s.speakerName)));
    const recentTime = Date.now() / 1000 - 300; // Last 5 minutes
    
    return [
      { icon: BarChart3, text: "Summarize the entire meeting", category: "meeting" },
      { icon: Clock, text: "What happened in the last 5 minutes?", category: "time-based" },
      { icon: MessageSquare, text: `What did ${speakers[0] || 'the main speaker'} say about decisions?`, category: "speaker" },
      { icon: Lightbulb, text: "What are the key action items discussed?", category: "analysis" },
      { icon: Search, text: "Find mentions of budget or timeline", category: "search" },
      { icon: Brain, text: "Write an article about project management best practices", category: "general" }
    ];
  };

  // Build comprehensive context index
  const buildContextIndex = (transcriptionData: TranscriptionSegment[]) => {
    const index = new Map();
    
    // Time-based indexing (5-minute windows)
    const timeIndex = new Map();
    const speakerIndex = new Map();
    const keywordIndex = new Map();
    
    transcriptionData.forEach(segment => {
      // Time windows
      const timeWindow = Math.floor(segment.startTime / 300) * 300;
      if (!timeIndex.has(timeWindow)) {
        timeIndex.set(timeWindow, []);
      }
      timeIndex.get(timeWindow).push(segment);
      
      // Speaker indexing
      if (!speakerIndex.has(segment.speakerName)) {
        speakerIndex.set(segment.speakerName, []);
      }
      speakerIndex.get(segment.speakerName).push(segment);
      
      // Keyword indexing
      const keywords = extractKeywords(segment.text);
      keywords.forEach(keyword => {
        if (!keywordIndex.has(keyword.toLowerCase())) {
          keywordIndex.set(keyword.toLowerCase(), []);
        }
        keywordIndex.get(keyword.toLowerCase()).push(segment);
      });
    });
    
    index.set('byTime', timeIndex);
    index.set('bySpeaker', speakerIndex);
    index.set('byKeywords', keywordIndex);
    index.set('chronological', transcriptionData.sort((a, b) => a.startTime - b.startTime));
    
    return index;
  };

  // Extract keywords using simple NLP
  const extractKeywords = (text: string): string[] => {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall']);
    
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  };

  // Analyze query intent using Groq
  const analyzeQueryIntent = async (query: string): Promise<QueryAnalysis> => {
    try {
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: `Analyze this query and return ONLY a JSON object: "${query}"
          
          Format: {
            "type": "MEETING_SPECIFIC|GENERAL_KNOWLEDGE|TIME_BASED|SPEAKER_SPECIFIC|HYBRID",
            "timeRange": "last X minutes/hours" or null,
            "speakerMentioned": "speaker name" or null,
            "keywords": ["relevant", "keywords"],
            "intent": "summary|question|analysis|search",
            "needsMeetingData": true/false
          }`,
          systemPrompt: "You are a query analysis system. Return only valid JSON."
        }
      });

      if (error) throw error;
      
      try {
        return JSON.parse(data.response);
      } catch {
        // Fallback analysis
        return {
          type: query.toLowerCase().includes('what') || query.toLowerCase().includes('who') ? 'MEETING_SPECIFIC' : 'GENERAL_KNOWLEDGE',
          keywords: extractKeywords(query),
          intent: 'question',
          needsMeetingData: transcriptionHistory.length > 0
        };
      }
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        type: 'HYBRID',
        keywords: extractKeywords(query),
        intent: 'question',
        needsMeetingData: transcriptionHistory.length > 0
      };
    }
  };

  // Handle time-based queries
  const handleTimeBasedQuery = (analysis: QueryAnalysis): TranscriptionSegment[] => {
    if (!analysis.timeRange) return [];
    
    const timeInSeconds = parseTimeRange(analysis.timeRange);
    const currentTime = Date.now() / 1000;
    const startTime = currentTime - timeInSeconds;
    
    let relevantSegments = transcriptionHistory.filter(segment => 
      segment.startTime >= startTime
    );
    
    if (analysis.speakerMentioned) {
      relevantSegments = relevantSegments.filter(segment => 
        segment.speakerName.toLowerCase().includes(analysis.speakerMentioned!.toLowerCase())
      );
    }
    
    return relevantSegments.slice(0, 10);
  };

  // Parse time range from natural language
  const parseTimeRange = (timeRange: string): number => {
    const minutes = timeRange.match(/(\d+)\s*minutes?/i);
    const hours = timeRange.match(/(\d+)\s*hours?/i);
    
    if (minutes) return parseInt(minutes[1]) * 60;
    if (hours) return parseInt(hours[1]) * 3600;
    return 300; // Default 5 minutes
  };

  // Find relevant segments using keyword matching and relevance scoring
  const findRelevantSegments = (query: string, keywords: string[]): TranscriptionSegment[] => {
    return transcriptionHistory
      .map(segment => ({
        ...segment,
        relevanceScore: calculateRelevanceScore(segment, query, keywords)
      }))
      .filter(segment => segment.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
  };

  // Calculate relevance score for segments
  const calculateRelevanceScore = (segment: TranscriptionSegment, query: string, keywords: string[]): number => {
    let score = 0;
    const segmentText = segment.text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Direct query term matches
    const queryTerms = queryLower.split(' ').filter(term => term.length > 2);
    queryTerms.forEach(term => {
      if (segmentText.includes(term)) {
        score += 2;
      }
    });
    
    // Keyword matches
    keywords.forEach(keyword => {
      if (segmentText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    });
    
    // Confidence bonus
    score *= (segment.confidence || 0.8);
    
    // Recent content bonus
    const age = (Date.now() / 1000) - segment.startTime;
    const recencyBonus = Math.max(0, 1 - (age / 3600)); // Decay over 1 hour
    score *= (1 + recencyBonus * 0.3);
    
    return score;
  };

  // Process different types of queries
  const processQuery = async (userQuery: string) => {
    setIsLoading(true);
    
    try {
      const analysis = await analyzeQueryIntent(userQuery);
      let relevantSegments: TranscriptionSegment[] = [];
      let context = '';
      
      // Handle different query types
      switch (analysis.type) {
        case 'TIME_BASED':
          relevantSegments = handleTimeBasedQuery(analysis);
          break;
        case 'SPEAKER_SPECIFIC':
        case 'MEETING_SPECIFIC':
          relevantSegments = findRelevantSegments(userQuery, analysis.keywords);
          break;
        case 'HYBRID':
          relevantSegments = findRelevantSegments(userQuery, analysis.keywords);
          break;
      }
      
      // Build context from relevant segments
      if (relevantSegments.length > 0) {
        context = relevantSegments
          .map(segment => `[${segment.speakerName}] (${formatTime(segment.startTime)}): ${segment.text}`)
          .join('\n');
      }
      
      // Determine system prompt based on query type
      let systemPrompt = '';
      if (analysis.needsMeetingData && context) {
        systemPrompt = `You are an intelligent meeting assistant. Based on the provided meeting transcript, answer the user's question accurately.

MEETING CONTEXT:
${context}

Instructions:
- Provide specific quotes with timestamps when relevant
- Include speaker names when referencing what someone said
- If information isn't available in the meeting, clearly state that
- Be conversational but professional
- Format responses with clear sections and bullet points`;
      } else {
        systemPrompt = `You are a helpful AI assistant. Answer the user's question with accurate, comprehensive information. Be conversational and provide detailed, well-structured responses.`;
      }
      
      // Get AI response
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: userQuery,
          context: context,
          systemPrompt: systemPrompt
        }
      });
      
      if (error) throw error;
      
      // Add messages to chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: userQuery,
        timestamp: new Date().toLocaleTimeString(),
        category: analysis.type.toLowerCase() as any
      };
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date().toLocaleTimeString(),
        category: analysis.type.toLowerCase() as any,
        relevantSegments: relevantSegments
      };
      
      setMessages(prev => [...prev, userMessage, aiMessage]);
      
      // Save to database if meeting ID exists
      if (meetingId) {
        await supabase
          .from('live_chat_messages')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            meeting_id: meetingId,
            message: userQuery,
            ai_response: data.response,
            context_summary: context.substring(0, 500)
          });
      }
      
    } catch (error) {
      console.error('Error processing query:', error);
      toast.error('Failed to process your question. Please try again.');
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ I encountered an error processing your question. Please try rephrasing or check your connection.',
        timestamp: new Date().toLocaleTimeString(),
        category: 'general'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format time for display
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  // Handle message sending
  const handleSendMessage = (messageText?: string) => {
    const message = messageText || inputMessage.trim();
    if (!message) return;
    
    processQuery(message);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        type: 'assistant',
        content: `🧠 **Intelligent Meeting Assistant Ready!**

I'm your advanced AI assistant with comprehensive meeting intelligence. I can:

**📊 Meeting Analysis:**
- Answer questions about your meeting content
- Provide time-based summaries ("What happened in the last 10 minutes?")
- Analyze speaker contributions and key points
- Extract action items and decisions

**🔍 Smart Search:**
- Find specific mentions or topics
- Locate when someone said something
- Search by speaker or time range

**🌟 General Knowledge:**
- Write articles and detailed explanations
- Answer questions beyond meeting context
- Provide expert insights and recommendations

**⚡ Quick Actions:**
Try asking things like:
- "Summarize the key decisions made"
- "What did John say about the budget?"
- "What happened in the last 5 minutes?"
- "Write an article about effective meetings"

What would you like to explore?`,
        timestamp: new Date().toLocaleTimeString(),
        category: 'general'
      }]);
    }
  }, []);

  // Update context index when transcription changes
  useEffect(() => {
    if (transcriptionHistory.length > 0) {
      const newIndex = buildContextIndex(transcriptionHistory);
      setContextIndex(newIndex);
    }
  }, [transcriptionHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'meeting': return 'from-blue-500 to-cyan-500';
      case 'time-based': return 'from-purple-500 to-pink-500';
      case 'general': return 'from-green-500 to-emerald-500';
      case 'analysis': return 'from-orange-500 to-red-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'meeting': return MessageSquare;
      case 'time-based': return Clock;
      case 'general': return Brain;
      case 'analysis': return BarChart3;
      default: return Sparkles;
    }
  };

  const smartSuggestions = getSmartSuggestions();

  return (
    <Card className="h-full bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl">
      <CardHeader className="pb-3 border-b border-purple-500/20">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Intelligent Meeting Assistant
              </span>
              <div className="text-xs text-purple-300">
                Advanced AI • Meeting Intelligence • General Knowledge
              </div>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse">
            <Sparkles className="w-3 h-3 mr-1" />
            SMART
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-full">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col">
          <div className="px-4 pt-3">
            <TabsList className="grid w-full grid-cols-2 bg-black/40">
              <TabsTrigger value="chat" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                <MessageSquare className="w-4 h-4 mr-2" />
                Intelligent Chat
              </TabsTrigger>
              <TabsTrigger value="actions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
                <Lightbulb className="w-4 h-4 mr-2" />
                Smart Actions
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 flex flex-col m-0">
            <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
              <div className="space-y-4 py-4">
                <AnimatePresence>
                  {messages.map((message) => {
                    const CategoryIcon = getCategoryIcon(message.category);
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${message.type === 'user' ? 'order-1' : 'order-2'}`}>
                          <div className={`flex items-start space-x-3 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              message.type === 'user' 
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                                : `bg-gradient-to-r ${getCategoryColor(message.category)}`
                            }`}>
                              {message.type === 'user' ? (
                                <User className="w-4 h-4 text-white" />
                              ) : (
                                <CategoryIcon className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className={`rounded-xl p-4 ${
                              message.type === 'user' 
                                ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30' 
                                : 'bg-white/10 backdrop-blur-sm border border-white/20'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-white/80">
                                  {message.type === 'user' ? 'You' : 'AI Assistant'}
                                </span>
                                <div className="flex items-center space-x-2">
                                  {message.category && (
                                    <Badge variant="outline" className="text-xs border-white/30 text-white/70">
                                      {message.category}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-white/60">{message.timestamp}</span>
                                </div>
                              </div>
                              <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                                {message.content}
                              </div>
                              {message.relevantSegments && message.relevantSegments.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/20">
                                  <div className="text-xs text-white/70 mb-2">📝 Referenced Quotes:</div>
                                  {message.relevantSegments.slice(0, 2).map((segment, idx) => (
                                    <div key={idx} className="text-xs text-white/60 mb-1">
                                      • <strong>{segment.speakerName}</strong>: "{segment.text.substring(0, 100)}..."
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-start"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-white/80 text-sm ml-2">Analyzing with AI intelligence...</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-purple-500/20">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your meeting or any topic..."
                  className="flex-1 bg-white/10 border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="flex-1 m-0">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Smart Suggestions</h3>
              <div className="grid grid-cols-1 gap-3">
                {smartSuggestions.map((action, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleSendMessage(action.text)}
                    className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all duration-300 text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${getCategoryColor(action.category)} flex items-center justify-center`}>
                      <action.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white text-sm">{action.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
