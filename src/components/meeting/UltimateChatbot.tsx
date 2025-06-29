
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Bot, User, Brain, Sparkles, FileText, MessageSquare, BarChart3, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'meeting' | 'general' | 'analysis';
}

interface UltimateChatbotProps {
  meetingId: string | null;
  transcriptionHistory: TranscriptionSegment[];
}

export const UltimateChatbot: React.FC<UltimateChatbotProps> = ({
  meetingId,
  transcriptionHistory
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Quick action suggestions
  const quickActions = [
    { icon: FileText, text: "Summarize this meeting", category: "meeting" },
    { icon: BarChart3, text: "What are the key discussion points?", category: "meeting" },
    { icon: Lightbulb, text: "What action items were discussed?", category: "meeting" },
    { icon: MessageSquare, text: "Who spoke the most?", category: "meeting" },
    { icon: Brain, text: "Write an article about AI trends", category: "general" },
    { icon: Sparkles, text: "Explain quantum computing", category: "general" }
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        type: 'assistant',
        content: `🚀 **Ultimate AI Assistant Ready!**

I'm your advanced AI assistant powered by Groq's latest models. I can help you with:

**📋 Meeting Analysis:**
- Summarize discussions and extract key points
- Identify action items and decisions
- Analyze speaker contributions and engagement
- Generate meeting reports and insights

**🧠 General Knowledge:**
- Write detailed articles on any topic
- Explain complex concepts clearly
- Provide expert advice and recommendations
- Answer questions across all domains

**✨ Creative Writing:**
- Generate comprehensive content
- Create structured documents
- Develop strategic recommendations

What would you like to explore today?`,
        timestamp: new Date().toLocaleTimeString(),
        category: 'general'
      }]);
    }
  }, []);

  const sendMessage = async (messageText?: string) => {
    const message = messageText || inputMessage.trim();
    if (!message) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      category: determineMessageCategory(message)
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Determine if this is a meeting-related query
      const isMeetingQuery = isMeetingRelated(message) && transcriptionHistory.length > 0;
      
      // Prepare context
      let context = '';
      if (isMeetingQuery) {
        context = transcriptionHistory
          .filter(segment => segment.isFinal)
          .map(segment => `${segment.speaker}: ${segment.text}`)
          .join('\n');
      }

      // Call the enhanced Groq function
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: message,
          context: context
        }
      });

      if (error) {
        throw error;
      }

      // Add AI response
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || 'I apologize, but I encountered an issue processing your request.',
        timestamp: new Date().toLocaleTimeString(),
        category: isMeetingQuery ? 'meeting' : 'general'
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save to database if meeting-related
      if (meetingId) {
        await supabase
          .from('live_chat_messages')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            meeting_id: meetingId,
            message: message,
            ai_response: data.response,
            context_summary: context ? context.substring(0, 500) : null
          });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get AI response. Please try again.');
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ I apologize, but I encountered an error. Please try rephrasing your question or check your connection.',
        timestamp: new Date().toLocaleTimeString(),
        category: 'general'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const determineMessageCategory = (message: string): 'meeting' | 'general' | 'analysis' => {
    const meetingKeywords = ['meeting', 'discussion', 'speaker', 'action item', 'summary', 'transcript'];
    const analysisKeywords = ['analyze', 'insights', 'key points', 'statistics', 'trends'];
    
    const lowerMessage = message.toLowerCase();
    
    if (analysisKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'analysis';
    }
    
    if (meetingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'meeting';
    }
    
    return 'general';
  };

  const isMeetingRelated = (message: string): boolean => {
    const meetingKeywords = [
      'meeting', 'discussion', 'conversation', 'transcript', 'speakers', 'participants',
      'summary', 'action item', 'decision', 'agenda', 'minutes', 'who said', 'what did',
      'key points', 'main topics', 'conclusions'
    ];
    
    return meetingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'meeting': return 'from-blue-500 to-cyan-500';
      case 'analysis': return 'from-purple-500 to-pink-500';
      case 'general': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'meeting': return MessageSquare;
      case 'analysis': return BarChart3;
      case 'general': return Brain;
      default: return Sparkles;
    }
  };

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
                Ultimate AI Assistant
              </span>
              <div className="text-xs text-purple-300">
                Powered by Groq • Multi-domain Expert
              </div>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse">
            <Sparkles className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-3">
            <TabsList className="grid w-full grid-cols-3 bg-black/40">
              <TabsTrigger value="chat" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="actions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
                <Lightbulb className="w-4 h-4 mr-2" />
                Quick Actions
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                <BarChart3 className="w-4 h-4 mr-2" />
                Insights
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
                                  {message.type === 'user' ? 'You' : 'Ultimate AI'}
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
                          <span className="text-white/80 text-sm ml-2">Ultimate AI is thinking...</span>
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
                  placeholder="Ask me anything about the meeting or any topic..."
                  className="flex-1 bg-white/10 border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => sendMessage()}
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
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3">
                {quickActions.map((action, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      setActiveTab('chat');
                      sendMessage(action.text);
                    }}
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

          <TabsContent value="insights" className="flex-1 m-0">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Meeting Insights</h3>
              {transcriptionHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <h4 className="font-medium text-white mb-2">📊 Session Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-purple-300">Total Segments:</span>
                        <span className="text-white ml-2">{transcriptionHistory.length}</span>
                      </div>
                      <div>
                        <span className="text-purple-300">Speakers:</span>
                        <span className="text-white ml-2">
                          {new Set(transcriptionHistory.map(s => s.speaker)).size}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setActiveTab('chat');
                      sendMessage('Provide a comprehensive analysis of this meeting including key insights, speaker contributions, and action items.');
                    }}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Generate Full Analysis
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                  <p className="text-purple-300 text-sm">
                    Start recording to see meeting insights and analysis options.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
