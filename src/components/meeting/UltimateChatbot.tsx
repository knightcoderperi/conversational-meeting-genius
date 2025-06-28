
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Bot, User, Sparkles, Zap, Brain, Stars, Globe, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  category: 'meeting' | 'general' | 'article';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const meetingQueries = [
    { icon: "📝", text: "Summarize the key points discussed", color: "from-blue-500 to-cyan-500" },
    { icon: "✅", text: "What action items were mentioned?", color: "from-green-500 to-emerald-500" },
    { icon: "💡", text: "What decisions were made?", color: "from-purple-500 to-pink-500" },
    { icon: "🔍", text: "Analyze the main topics", color: "from-orange-500 to-red-500" },
    { icon: "⏰", text: "What happened in the last 5 minutes?", color: "from-indigo-500 to-purple-500" },
    { icon: "📊", text: "Generate meeting insights", color: "from-teal-500 to-green-500" }
  ];

  const generalQueries = [
    { icon: "📰", text: "Write an article about productivity", color: "from-pink-500 to-rose-500" },
    { icon: "💼", text: "Best practices for team meetings", color: "from-amber-500 to-yellow-500" },
    { icon: "🚀", text: "Latest tech trends 2024", color: "from-violet-500 to-purple-500" },
    { icon: "📈", text: "Business growth strategies", color: "from-emerald-500 to-teal-500" },
    { icon: "🧠", text: "AI and machine learning basics", color: "from-blue-500 to-indigo-500" },
    { icon: "🎯", text: "Project management tips", color: "from-red-500 to-pink-500" }
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getMeetingContext = (): string => {
    const finalSegments = transcriptionHistory.filter(segment => segment.isFinal);
    if (finalSegments.length === 0) {
      return '';
    }
    
    return finalSegments
      .map(segment => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
      .join('\n');
  };

  const determineQueryType = (message: string): 'meeting' | 'general' => {
    const meetingKeywords = [
      'meeting', 'discussion', 'said', 'mentioned', 'decided', 'action item', 
      'agenda', 'participant', 'speaker', 'transcript', 'summary', 'what did'
    ];
    
    const generalKeywords = [
      'article', 'write', 'explain', 'how to', 'what is', 'tell me about',
      'best practices', 'trends', 'tips', 'guide', 'tutorial'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    const meetingMatches = meetingKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    const generalMatches = generalKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    
    // If we have meeting context and meeting-related keywords, prioritize meeting
    const hasContext = getMeetingContext().trim().length > 0;
    
    if (hasContext && meetingMatches > 0) {
      return 'meeting';
    }
    
    return generalMatches > meetingMatches ? 'general' : 'meeting';
  };

  const typeMessage = async (content: string): Promise<void> => {
    return new Promise((resolve) => {
      const words = content.split(' ');
      let currentText = '';
      let wordIndex = 0;

      const typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
          currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.isTyping) {
              lastMessage.content = currentText;
            }
            return newMessages;
          });
          
          wordIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
              lastMessage.isTyping = false;
            }
            return newMessages;
          });
          
          resolve();
        }
      }, 50);
    });
  };

  const sendMessageToAI = async (message: string) => {
    const queryType = determineQueryType(message);
    const context = getMeetingContext();
    
    setIsProcessing(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
      category: queryType
    };
    
    setMessages(prev => [...prev, userMessage]);

    let aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isTyping: true,
      category: queryType
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(true);

    try {
      console.log('🧠 Sending to Ultimate AI:', { message, queryType, contextLength: context.length });
      
      let aiPrompt = '';
      let aiContext = '';

      if (queryType === 'meeting' && context.trim()) {
        aiPrompt = `You are an AI assistant analyzing a meeting. Answer the following question based on the meeting transcription: ${message}`;
        aiContext = context;
      } else if (queryType === 'general' || !context.trim()) {
        if (message.toLowerCase().includes('article')) {
          aiPrompt = `You are a professional content writer. Create a comprehensive, well-structured article about: ${message}. Include headings, bullet points, and actionable insights. Make it engaging and informative.`;
          aiContext = '';
        } else {
          aiPrompt = `You are a knowledgeable AI assistant. Provide a detailed, helpful response to: ${message}. Be comprehensive, accurate, and include practical examples where relevant.`;
          aiContext = '';
        }
      } else {
        aiPrompt = message;
        aiContext = context;
      }
      
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: aiPrompt,
          context: aiContext
        }
      });

      if (error) {
        console.error('Ultimate AI function error:', error);
        throw new Error(error.message);
      }

      if (!data || !data.response) {
        throw new Error('No response received from Ultimate AI');
      }

      await typeMessage(data.response);

      // Update message category
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'ai') {
          lastMessage.category = queryType;
        }
        return newMessages;
      });

      if (meetingId) {
        await saveChatMessage(meetingId, message, data.response, queryType);
      }
      
    } catch (error) {
      console.error('Error getting Ultimate AI response:', error);
      toast.error('🤖 Ultimate AI assistant encountered an error. Please try again.');
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'ai') {
          lastMessage.content = `Sorry, I encountered an error while processing your request. ${
            queryType === 'meeting' 
              ? 'For meeting-related questions, please ensure you have spoken during the recording.' 
              : 'Please try rephrasing your question.'
          }`;
          lastMessage.isTyping = false;
        }
        return newMessages;
      });
      setIsTyping(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveChatMessage = async (meetingId: string, message: string, aiResponse: string, category: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('live_chat_messages')
        .insert({
          meeting_id: meetingId,
          user_id: user?.id,
          message,
          ai_response: aiResponse,
          context_summary: category === 'meeting' ? getMeetingContext().slice(0, 500) : `General query: ${category}`
        });
    } catch (error) {
      console.error('Error saving ultimate chat message:', error);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessageToAI(inputMessage);
      setInputMessage('');
    }
  };

  const handleQuickQuery = (query: string) => {
    sendMessageToAI(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasTranscriptionData = transcriptionHistory.some(segment => segment.isFinal);
  const transcriptionCount = transcriptionHistory.filter(s => s.isFinal).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'meeting': return <MessageSquare className="w-3 h-3" />;
      case 'article': return <FileText className="w-3 h-3" />;
      case 'general': return <Globe className="w-3 h-3" />;
      default: return <Brain className="w-3 h-3" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'meeting': return 'from-blue-500 to-cyan-500';
      case 'article': return 'from-green-500 to-emerald-500';
      case 'general': return 'from-purple-500 to-pink-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Card className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20 border-0 shadow-2xl backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold flex items-center space-x-2">
                <span>🚀 Ultimate AI Assistant</span>
                <Stars className="w-5 h-5 animate-pulse" />
              </span>
              <p className="text-blue-100 text-sm">Meeting Analysis + General Knowledge + Article Writing</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              <Globe className="w-3 h-3 mr-1" />
              Unlimited
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              <Zap className="w-3 h-3 mr-1" />
              {transcriptionCount} segments
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      {/* Dual Mode Quick Queries */}
      <div className="px-4 py-3 bg-gradient-to-r from-white/80 to-white/60 dark:from-slate-800/80 dark:to-slate-800/60 backdrop-blur-sm">
        <div className="space-y-3">
          {hasTranscriptionData && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center">
                <MessageSquare className="w-3 h-3 mr-1" />
                Meeting Analysis
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {meetingQueries.map((query, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickQuery(query.text)}
                    className={`text-xs h-auto py-2 px-3 justify-start bg-gradient-to-r ${query.color} text-white border-0 hover:scale-105 transition-all duration-300 hover:shadow-lg`}
                    disabled={isProcessing}
                  >
                    <span className="text-base mr-2">{query.icon}</span>
                    <span className="font-medium">{query.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center">
              <Globe className="w-3 h-3 mr-1" />
              General Knowledge & Articles
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {generalQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuery(query.text)}
                  className={`text-xs h-auto py-2 px-3 justify-start bg-gradient-to-r ${query.color} text-white border-0 hover:scale-105 transition-all duration-300 hover:shadow-lg`}
                  disabled={isProcessing}
                >
                  <span className="text-base mr-2">{query.icon}</span>
                  <span className="font-medium">{query.text}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Brain className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  🧠 Ultimate AI Assistant Ready
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-sm mx-auto">
                  I can analyze your meeting, write articles, answer general questions, and provide expert insights on any topic
                </p>
                <div className="space-y-2">
                  {hasTranscriptionData && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✅ Meeting analysis ready with {transcriptionCount} segments
                    </p>
                  )}
                  <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center"><MessageSquare className="w-3 h-3 mr-1 text-blue-500" />Meeting Analysis</span>
                    <span className="flex items-center"><FileText className="w-3 h-3 mr-1 text-green-500" />Article Writing</span>
                    <span className="flex items-center"><Globe className="w-3 h-3 mr-1 text-purple-500" />General Knowledge</span>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'bg-white/80 dark:bg-slate-800/80 text-gray-900 dark:text-gray-100 shadow-lg backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {message.type === 'ai' && (
                      <div className={`w-6 h-6 bg-gradient-to-r ${getCategoryColor(message.category)} rounded-full flex items-center justify-center flex-shrink-0 mt-1`}>
                        {getCategoryIcon(message.category)}
                      </div>
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      {message.type === 'ai' && (
                        <Badge 
                          className={`bg-gradient-to-r ${getCategoryColor(message.category)} text-white border-0 mb-2 text-xs`}
                        >
                          {getCategoryIcon(message.category)}
                          <span className="ml-1 capitalize">{message.category}</span>
                        </Badge>
                      )}
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed font-medium ${message.isTyping ? 'animate-pulse' : ''}`}>
                        {message.content}
                        {message.isTyping && <span className="animate-pulse">|</span>}
                      </p>
                      <p className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && !isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl px-4 py-3 max-w-[85%] shadow-lg backdrop-blur-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                      <Brain className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      🧠 Ultimate AI is processing...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="border-t bg-gradient-to-r from-white/90 to-white/70 dark:from-slate-800/90 dark:to-slate-800/70 backdrop-blur-sm p-4">
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="✨ Ask about the meeting, request an article, or ask anything..."
              disabled={isProcessing}
              className="flex-1 bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim()}
              size="sm"
              className="px-4 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 hover:from-blue-600 hover:via-purple-700 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 text-center space-y-1">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ✅ Ultimate AI ready • Meeting analysis + General knowledge + Article writing
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                {hasTranscriptionData ? `${transcriptionCount} segments` : 'No meeting data'}
              </span>
              <span className="flex items-center">
                <Globe className="w-3 h-3 mr-1 text-purple-500" />
                Unlimited topics
              </span>
              <span className="flex items-center">
                <FileText className="w-3 h-3 mr-1 text-green-500" />
                Article generation
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
