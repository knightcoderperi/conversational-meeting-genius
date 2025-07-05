import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Send, Bot, User, Sparkles, Brain, Zap } from 'lucide-react';
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
  source: 'meeting' | 'general';
}

interface UniversalAIChatbotProps {
  meetingId: string | null;
  transcriptionHistory: TranscriptionSegment[];
}

export const UniversalAIChatbot: React.FC<UniversalAIChatbotProps> = ({
  meetingId,
  transcriptionHistory
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeMode, setActiveMode] = useState<'meeting' | 'general'>('meeting');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Enhanced quick action buttons
  const meetingQueries = [
    "📝 Summarize the entire meeting",
    "✅ List all action items and decisions",
    "💬 What were the key discussion points?",
    "👥 Show speaker participation breakdown",
    "🎯 What are the next steps?",
    "📊 Generate meeting analytics"
  ];

  const generalQueries = [
    "💡 Help me brainstorm ideas",
    "📚 Explain a concept to me",
    "🔍 Research information",
    "✏️ Help me write something",
    "🧮 Solve a problem",
    "🌐 General knowledge questions"
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

  const sendMessageToAI = async (message: string, mode: 'meeting' | 'general' = activeMode) => {
    setIsProcessing(true);
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
      source: mode
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      let response;
      
      if (mode === 'meeting') {
        // Use Groq for meeting-related queries
        const context = getMeetingContext();
        
        if (!context.trim()) {
          toast.error('No meeting transcription available yet. Please start speaking during the recording.');
          setIsProcessing(false);
          return;
        }

        console.log('Sending to Groq AI for meeting analysis:', { message, contextLength: context.length });
        
        response = await supabase.functions.invoke('groq-chat', {
          body: {
            message: message,
            context: context,
            mode: 'meeting'
          }
        });
      } else {
        // Use Cyber Alpha for general queries
        console.log('Sending to Cyber Alpha for general query:', { message });
        
        response = await supabase.functions.invoke('cyber-alpha-chat', {
          body: {
            message: message,
            mode: 'general'
          }
        });
      }

      if (response.error) {
        console.error('AI function error:', response.error);
        throw new Error(response.error.message);
      }

      if (!response.data || !response.data.response) {
        throw new Error('No response received from AI');
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.data.response,
        timestamp: new Date(),
        source: mode
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save to database if meeting ID exists
      if (meetingId) {
        await saveChatMessage(meetingId, message, response.data.response, mode);
      }
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error(`Failed to get AI response. Please try again.`);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: mode === 'meeting' 
          ? 'Sorry, I encountered an error while analyzing the meeting. Please make sure you have spoken during the recording.'
          : 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        source: mode
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveChatMessage = async (meetingId: string, message: string, aiResponse: string, source: 'meeting' | 'general') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('live_chat_messages')
        .insert({
          meeting_id: meetingId,
          user_id: user?.id,
          message,
          ai_response: aiResponse,
          context_summary: source === 'meeting' ? getMeetingContext().slice(0, 500) : 'General conversation',
          ai_source: source
        });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessageToAI(inputMessage, activeMode);
      setInputMessage('');
    }
  };

  const handleQuickQuery = (query: string) => {
    sendMessageToAI(query, activeMode);
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span>Universal AI Assistant</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={hasTranscriptionData ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500"}>
              {activeMode === 'meeting' ? `${transcriptionCount} segments` : 'General Mode'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      {/* Mode Tabs */}
      <div className="px-4 pb-3">
        <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'meeting' | 'general')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meeting" className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span>Meeting Focus</span>
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>General AI</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Quick Query Buttons */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {(activeMode === 'meeting' ? meetingQueries : generalQueries).map((query, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickQuery(query)}
              className="text-xs h-auto py-2 px-3 justify-start hover:bg-blue-50 hover:border-blue-200 text-left"
              disabled={isProcessing || (activeMode === 'meeting' && !hasTranscriptionData)}
            >
              {query}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Messages */}
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {activeMode === 'meeting' ? 'Meeting AI Assistant Ready' : 'General AI Assistant Ready'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {activeMode === 'meeting' 
                    ? (hasTranscriptionData 
                        ? `I can analyze your meeting with ${transcriptionCount} transcribed segments`
                        : 'Start speaking during the recording to enable meeting analysis')
                    : 'Ask me anything! I can help with questions, explanations, brainstorming, and more.'
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
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.source === 'meeting'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border border-purple-200 dark:border-purple-700'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'ai' && (
                      <div className="flex items-center space-x-1">
                        <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                        {message.source === 'meeting' && (
                          <Brain className="w-3 h-3 mt-1 flex-shrink-0" />
                        )}
                        {message.source === 'general' && (
                          <Zap className="w-3 h-3 mt-1 flex-shrink-0" />
                        )}
                      </div>
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                        {message.type === 'ai' && (
                          <Badge variant="outline" className="text-xs py-0 px-1">
                            {message.source === 'meeting' ? 'Meeting AI' : 'General AI'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className={`rounded-lg px-4 py-3 max-w-[85%] ${
                  activeMode === 'meeting' 
                    ? 'bg-purple-100 dark:bg-purple-900 border border-purple-200 dark:border-purple-700'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    {activeMode === 'meeting' ? <Brain className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {activeMode === 'meeting' ? 'Analyzing meeting...' : 'Thinking...'}
                    </span>
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
              onKeyPress={handleKeyPress}
              placeholder={
                activeMode === 'meeting' 
                  ? (hasTranscriptionData ? "Ask about the meeting..." : "Start speaking to enable meeting chat")
                  : "Ask me anything..."
              }
              disabled={isProcessing || (activeMode === 'meeting' && !hasTranscriptionData)}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim() || (activeMode === 'meeting' && !hasTranscriptionData)}
              size="sm"
              className="px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {activeMode === 'meeting' 
                ? (hasTranscriptionData 
                    ? `✅ Meeting analysis ready (${transcriptionCount} segments)`
                    : '💡 Speak during recording to enable meeting chat')
                : '🌟 General AI mode: Ask me anything!'
              }
            </p>
            <Badge variant="outline" className="text-xs">
              {activeMode === 'meeting' ? 'Groq AI' : 'Cyber Alpha AI'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};