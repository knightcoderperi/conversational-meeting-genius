
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

  // Quick action buttons for meeting analysis
  const quickQueries = [
    "📝 Summarize key points",
    "✅ List action items",
    "👥 Who spoke most?",
    "💡 Key decisions made",
    "🔍 Important topics",
    "⏱️ Meeting timeline",
    "📊 Speaker analysis",
    "🎯 Next steps"
  ];

  useEffect(() => {
    // Update context whenever new transcription comes in
    if (transcriptionHistory.length > 0) {
      const recentTranscripts = transcriptionHistory
        .filter(segment => segment.isFinal)
        .slice(-50) // Last 50 segments for context
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
      'meeting', 'discuss', 'speaker', 'said', 'talked', 'mentioned', 'action', 'decision',
      'summary', 'timeline', 'participant', 'topic', 'agenda', 'note', 'transcript'
    ];
    
    const lowerMessage = message.toLowerCase();
    return !meetingKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  const callGroqAPI = async (message: string, context?: string): Promise<string> => {
    try {
      const response = await fetch(`https://iofshnigmuxlxciymldk.supabase.co/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnNobmlnbXV4bHhjaXltbGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTE2NjIsImV4cCI6MjA2NjU4NzY2Mn0.FRW2owD1YTrEeXQNrH3f-7lJ-Nb0SbhkmyaAajDYn1o`,
        },
        body: JSON.stringify({
          message,
          context: context || null
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  };

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

      // Check if it's a general question or meeting-related
      if (isGeneralQuestion(message) || !meetingContext.trim()) {
        // Use Groq API for general questions
        aiResponse = await callGroqAPI(message, meetingContext.trim() || undefined);
        isGeneral = true;
        console.log('Using Groq API for general question');
      } else {
        // Use local analysis for meeting-related questions
        aiResponse = await generateMeetingResponse(message, meetingContext);
        console.log('Using local analysis for meeting question');
      }
      
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
      toast.error('Failed to get AI response');
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateMeetingResponse = async (query: string, context: string): Promise<string> => {
    // If we have meeting context, try Groq API first for better responses
    if (context.trim()) {
      try {
        return await callGroqAPI(query, context);
      } catch (error) {
        console.log('Groq API failed, falling back to local analysis');
      }
    }

    // Fallback to local pattern matching
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
      return generateSummary(context);
    } else if (lowerQuery.includes('action item')) {
      return extractActionItems(context);
    } else if (lowerQuery.includes('who spoke') || lowerQuery.includes('speaker')) {
      return analyzeSpeakers(context);
    } else if (lowerQuery.includes('decision') || lowerQuery.includes('conclude')) {
      return extractDecisions(context);
    } else if (lowerQuery.includes('topic') || lowerQuery.includes('subject')) {
      return extractTopics(context);
    } else if (lowerQuery.includes('timeline') || lowerQuery.includes('when')) {
      return generateTimeline(context);
    } else {
      return searchContent(query, context);
    }
  };

  const generateSummary = (context: string): string => {
    const lines = context.split('\n').filter(line => line.trim());
    if (lines.length === 0) return "No meeting content available yet.";
    
    const speakers = [...new Set(lines.map(line => line.split(': ')[0]?.split('] ')[1]).filter(Boolean))];
    const keyPoints = lines.slice(-10).map(line => line.split(': ').slice(1).join(': ')).filter(Boolean);
    
    return `📝 **Meeting Summary**\n\n**Participants:** ${speakers.join(', ')}\n\n**Recent Discussion Points:**\n${keyPoints.map(point => `• ${point}`).join('\n')}\n\n**Duration:** ${lines.length} segments recorded`;
  };

  const extractActionItems = (context: string): string => {
    const lines = context.split('\n');
    const actionWords = ['will', 'should', 'need to', 'must', 'action', 'task', 'follow up', 'next step'];
    
    const actionItems = lines.filter(line => 
      actionWords.some(word => line.toLowerCase().includes(word))
    ).slice(-5);
    
    if (actionItems.length === 0) {
      return "✅ No clear action items identified yet. Continue the meeting for more specific tasks.";
    }
    
    return `✅ **Action Items Identified:**\n\n${actionItems.map((item, index) => `${index + 1}. ${item.split(': ').slice(1).join(': ')}`).join('\n')}`;
  };

  const analyzeSpeakers = (context: string): string => {
    const lines = context.split('\n').filter(line => line.trim());
    const speakerCounts: { [key: string]: number } = {};
    
    lines.forEach(line => {
      const speaker = line.split(': ')[0]?.split('] ')[1];
      if (speaker) {
        speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
      }
    });
    
    const sortedSpeakers = Object.entries(speakerCounts)
      .sort(([,a], [,b]) => b - a);
    
    return `👥 **Speaker Analysis:**\n\n${sortedSpeakers.map(([speaker, count]) => `• **${speaker}**: ${count} segments (${Math.round((count / lines.length) * 100)}%)`).join('\n')}`;
  };

  const extractDecisions = (context: string): string => {
    const lines = context.split('\n');
    const decisionWords = ['decided', 'agreed', 'concluded', 'final', 'approve', 'reject'];
    
    const decisions = lines.filter(line => 
      decisionWords.some(word => line.toLowerCase().includes(word))
    ).slice(-3);
    
    if (decisions.length === 0) {
      return "💡 No clear decisions identified yet in the meeting.";
    }
    
    return `💡 **Key Decisions:**\n\n${decisions.map((decision, index) => `${index + 1}. ${decision.split(': ').slice(1).join(': ')}`).join('\n')}`;
  };

  const extractTopics = (context: string): string => {
    const text = context.toLowerCase();
    const commonWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'were', 'been', 'be', 'have', 'has', 'had'];
    
    const words = text.split(/\W+/).filter(word => 
      word.length > 4 && !commonWords.includes(word)
    );
    
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    const topTopics = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word);
    
    return `🔍 **Key Topics Discussed:**\n\n${topTopics.map(topic => `• ${topic.charAt(0).toUpperCase() + topic.slice(1)}`).join('\n')}`;
  };

  const generateTimeline = (context: string): string => {
    const lines = context.split('\n').filter(line => line.trim()).slice(-10);
    
    return `⏱️ **Recent Meeting Timeline:**\n\n${lines.map((line, index) => {
      const timestamp = line.match(/\[(.*?)\]/)?.[1] || 'Unknown time';
      const content = line.split(': ').slice(1).join(': ');
      return `${index + 1}. **${timestamp}** - ${content}`;
    }).join('\n')}`;
  };

  const searchContent = (query: string, context: string): string => {
    const lines = context.split('\n');
    const matchingLines = lines.filter(line => 
      line.toLowerCase().includes(query.toLowerCase())
    ).slice(-5);
    
    if (matchingLines.length === 0) {
      return `🔍 No mentions of "${query}" found in the current meeting transcript.`;
    }
    
    return `🔍 **Search Results for "${query}":**\n\n${matchingLines.map((line, index) => `${index + 1}. ${line.split(': ').slice(1).join(': ')}`).join('\n')}`;
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
            <span>AI Assistant</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {transcriptionHistory.length} segments
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Enhanced AI
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
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Ask about your meeting or any general questions
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
                      <div className="flex items-center space-x-1">
                        <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                        {message.isGeneral && (
                          <Badge variant="secondary" className="text-xs">
                            General AI
                          </Badge>
                        )}
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
            💡 Can answer both meeting-related and general questions
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
