
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Bot, User, Sparkles, Zap, Brain, Stars } from 'lucide-react';
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
}

interface SuperchargedAIChatbotProps {
  meetingId: string | null;
  transcriptionHistory: TranscriptionSegment[];
}

export const SuperchargedAIChatbot: React.FC<SuperchargedAIChatbotProps> = ({
  meetingId,
  transcriptionHistory
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickQueries = [
    { icon: "📝", text: "Summarize the key points discussed", color: "from-blue-500 to-cyan-500" },
    { icon: "✅", text: "What action items were mentioned?", color: "from-green-500 to-emerald-500" },
    { icon: "💡", text: "What decisions were made?", color: "from-purple-500 to-pink-500" },
    { icon: "🔍", text: "Analyze the main topics", color: "from-orange-500 to-red-500" },
    { icon: "⏰", text: "What happened in the last 5 minutes?", color: "from-indigo-500 to-purple-500" },
    { icon: "📊", text: "Generate meeting insights", color: "from-teal-500 to-green-500" }
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
    const context = getMeetingContext();
    
    if (!context.trim()) {
      toast.error('🎤 No meeting transcription available yet. Please start speaking during the recording.');
      return;
    }

    setIsProcessing(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isTyping: true
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(true);

    try {
      console.log('🧠 Sending to AI:', { message, contextLength: context.length });
      
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: message,
          context: context
        }
      });

      if (error) {
        console.error('AI function error:', error);
        throw new Error(error.message);
      }

      if (!data || !data.response) {
        throw new Error('No response received from AI');
      }

      await typeMessage(data.response);

      if (meetingId) {
        await saveChatMessage(meetingId, message, data.response);
      }
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error('🤖 AI assistant encountered an error. Please try again.');
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'ai') {
          lastMessage.content = 'Sorry, I encountered an error while processing your request. Please make sure you have spoken during the recording so I have meeting content to analyze.';
          lastMessage.isTyping = false;
        }
        return newMessages;
      });
      setIsTyping(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveChatMessage = async (meetingId: string, message: string, aiResponse: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('live_chat_messages')
        .insert({
          meeting_id: meetingId,
          user_id: user?.id,
          message,
          ai_response: aiResponse,
          context_summary: getMeetingContext().slice(0, 500)
        });
    } catch (error) {
      console.error('Error saving chat message:', error);
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

  return (
    <Card className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20 border-0 shadow-2xl backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
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
                <span>AI Meeting Assistant</span>
                <Stars className="w-5 h-5 animate-pulse" />
              </span>
              <p className="text-blue-100 text-sm">Powered by Advanced AI Intelligence</p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Zap className="w-3 h-3 mr-1" />
            {transcriptionCount} segments
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {hasTranscriptionData && (
        <div className="px-4 py-3 bg-gradient-to-r from-white/80 to-white/60 dark:from-slate-800/80 dark:to-slate-800/60 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2">
            {quickQueries.map((query, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuery(query.text)}
                className={`text-xs h-auto py-3 px-3 justify-start bg-gradient-to-r ${query.color} text-white border-0 hover:scale-105 transition-all duration-300 hover:shadow-lg`}
                disabled={isProcessing}
              >
                <span className="text-base mr-2">{query.icon}</span>
                <span className="font-medium">{query.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Brain className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  🧠 AI Assistant Ready
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 max-w-sm mx-auto">
                  {hasTranscriptionData 
                    ? `I'm analyzing your meeting with ${transcriptionCount} transcribed segments using advanced AI intelligence`
                    : 'Start speaking during the recording to unlock powerful AI meeting analysis'
                  }
                </p>
                {hasTranscriptionData && (
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center justify-center space-x-4">
                      <span className="flex items-center"><Sparkles className="w-3 h-3 mr-1 text-blue-500" />Smart Analysis</span>
                      <span className="flex items-center"><Zap className="w-3 h-3 mr-1 text-purple-500" />Instant Insights</span>
                      <span className="flex items-center"><Brain className="w-3 h-3 mr-1 text-green-500" />AI-Powered</span>
                    </div>
                  </div>
                )}
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
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Brain className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
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
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                      <Brain className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      🧠 AI is analyzing your meeting...
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
              placeholder={hasTranscriptionData ? "✨ Ask me anything about the meeting..." : "🎤 Start speaking to unlock AI chat"}
              disabled={isProcessing || !hasTranscriptionData}
              className="flex-1 bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim() || !hasTranscriptionData}
              size="sm"
              className="px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 text-center">
            {!hasTranscriptionData ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                🎤 Start speaking during recording to enable AI assistant
              </p>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✅ AI ready with {transcriptionCount} segments • Unlimited analysis power
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
