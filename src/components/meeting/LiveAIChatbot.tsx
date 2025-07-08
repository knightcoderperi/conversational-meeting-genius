
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
  isGeneral?: boolean;
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
  const [meetingContext, setMeetingContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Remove hardcoded API key - now using edge functions with configured secrets
  
  // Quick action buttons for meeting analysis
  const quickQueries = [
    "📝 Summarize key points from all speakers",
    "✅ List action items and who mentioned them",
    "👥 Who spoke most and what were their main points?",
    "💡 Key decisions made by each participant",
    "🔍 Important topics discussed by different speakers",
    "⏱️ Meeting timeline with speaker contributions",
    "📊 Speaker analysis and participation levels",
    "🎯 Next steps assigned to specific people"
  ];

  useEffect(() => {
    // Update context whenever new transcription comes in with speaker names
    if (transcriptionHistory.length > 0) {
      const recentTranscripts = transcriptionHistory
        .filter(segment => segment.isFinal)
        .slice(-100) // Increased to 100 segments for better context
        .map(segment => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
        .join('\n');
      setMeetingContext(recentTranscripts);
    }
  }, [transcriptionHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isGeneralQuestion = (message: string): boolean => {
    const meetingKeywords = [
      'meeting', 'discuss', 'speaker', 'spoke', 'said', 'talked', 'mentioned', 'action', 'decision',
      'summary', 'timeline', 'participant', 'topic', 'agenda', 'note', 'transcript', 'conversation',
      'call', 'session', 'presentation', 'colleague', 'team member', 'minutes', 'recording'
    ];
    
    const lowerMessage = message.toLowerCase();
    // Check if the message contains meeting-related keywords or if we have context
    const hasMeetingKeywords = meetingKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasTranscriptionContext = meetingContext.trim().length > 50;
    
    // If there's substantial meeting context, prefer meeting-focused AI unless clearly general
    if (hasTranscriptionContext && !isObviouslyGeneral(lowerMessage)) {
      return false; // Use meeting AI
    }
    
    return !hasMeetingKeywords;
  };

  const isObviouslyGeneral = (message: string): boolean => {
    const generalIndicators = [
      'weather', 'news', 'recipe', 'joke', 'story', 'definition', 'explain', 'how to',
      'what is', 'when did', 'where is', 'history of', 'tell me about', 'calculate',
      'translate', 'programming', 'code', 'algorithm', 'math', 'science'
    ];
    
    return generalIndicators.some(indicator => message.includes(indicator));
  };

  // Remove unused functions - now using edge function for all AI calls

  const sendMessageToAI = async (message: string) => {
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
      let aiResponse: string;
      let isGeneral = false;

      // Always use the edge function which will intelligently route between APIs
      const contextToSend = isGeneralQuestion(message) ? '' : meetingContext;
      isGeneral = contextToSend === '';

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message,
          context: contextToSend
        }
      });

      if (response.error) {
        throw new Error(`AI API call failed: ${response.error.message}`);
      }

      aiResponse = response.data.response;
      console.log(`Used ${isGeneral ? 'general' : 'meeting'} AI for question`);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
        isGeneral
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save to database
      if (meetingId) {
        await saveChatMessage(meetingId, message, aiResponse);
      }
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error('Failed to get AI response - check API configuration');
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please check that the API keys are properly configured.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveChatMessage = async (meetingId: string, message: string, aiResponse: string) => {
    try {
      await supabase
        .from('live_chat_messages')
        .insert({
          meeting_id: meetingId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          message,
          ai_response: aiResponse,
          context_summary: meetingContext.slice(0, 500)
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span>Enhanced AI Assistant</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {transcriptionHistory.length} segments
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Dual AI
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      {/* Quick Query Buttons */}
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
      
      {/* Messages */}
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Enhanced AI Assistant Ready
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Ask about your meeting or any general questions
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <div>🎯 <strong>Meeting Questions:</strong> Uses Groq AI with multi-speaker context</div>
                    <div>🌍 <strong>General Questions:</strong> Uses Cyber Alpha AI for any topic</div>
                    <div>👥 <strong>Speaker Analysis:</strong> Identifies and analyzes individual contributions</div>
                  </div>
                </div>
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
                      <div className="flex items-center space-x-1">
                        <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                        <Badge variant="secondary" className="text-xs">
                          {message.isGeneral ? 'General AI' : 'Meeting AI'}
                        </Badge>
                      </div>
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
              placeholder="Ask about the meeting or any general question..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim()}
              size="sm"
              className="px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Meeting questions use Groq AI with speaker context • General questions use Cyber Alpha AI
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
