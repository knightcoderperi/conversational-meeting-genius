
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Bot, User, Sparkles } from 'lucide-react';
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
}

interface LiveAIChatbotProps {
  meetingId: string | null;
  transcriptionHistory: TranscriptionSegment[];
}

export const LiveAIChatbot: React.FC<LiveAIChatbotProps> = ({
  meetingId,
  transcriptionHistory
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick action buttons for meeting analysis
  const quickQueries = [
    "📝 Summarize the meeting",
    "✅ What are the action items?",
    "💡 What decisions were made?",
    "🔍 What are the main topics?",
    "⏱️ What was discussed recently?",
    "📊 Give me meeting insights"
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getMeetingContext = (): string => {
    return transcriptionHistory
      .filter(segment => segment.isFinal)
      .map(segment => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
      .join('\n');
  };

  const sendMessageToAI = async (message: string) => {
    const context = getMeetingContext();
    
    if (!context.trim()) {
      toast.error('No meeting data available yet. Start recording to begin.');
      return;
    }

    setIsProcessing(true);
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call Groq AI edge function
      const { data, error } = await supabase.functions.invoke('groq-chat', {
        body: {
          message: message,
          context: context
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save to database
      if (meetingId) {
        await saveChatMessage(meetingId, message, data.response);
      }
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error('Failed to get AI response. Please check if Groq API key is configured.');
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please make sure the Groq API key is properly configured.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
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

  const hasTranscriptionData = transcriptionHistory.some(segment => segment.isFinal);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span>AI Assistant</span>
          </div>
          <Badge variant="outline" className={hasTranscriptionData ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500"}>
            {transcriptionHistory.filter(s => s.isFinal).length} segments
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {/* Quick Query Buttons */}
      {hasTranscriptionData && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {quickQueries.map((query, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuery(query)}
                className="text-xs h-auto py-2 px-3 justify-start hover:bg-blue-50 hover:border-blue-200"
                disabled={isProcessing}
              >
                {query}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Messages */}
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  AI Assistant Ready
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {hasTranscriptionData 
                    ? 'Ask questions about your meeting or use quick queries above'
                    : 'Start recording to enable AI assistant'
                  }
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'ai' && (
                      <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* Input */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={hasTranscriptionData ? "Ask about the meeting..." : "Start recording to enable chat"}
              disabled={isProcessing || !hasTranscriptionData}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim() || !hasTranscriptionData}
              size="sm"
              className="px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {!hasTranscriptionData && (
            <p className="text-xs text-gray-500 mt-2">
              Start recording to enable AI assistant
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
