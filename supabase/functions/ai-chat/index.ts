
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const groqApiKey = Deno.env.get('GROQ_API_KEY');
const openRouterApiKey = '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';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();

    // Check if it's a meeting-related question
    const meetingKeywords = [
      'meeting', 'discuss', 'speaker', 'said', 'talked', 'mentioned', 'action', 'decision',
      'summary', 'timeline', 'participant', 'topic', 'agenda', 'note', 'transcript'
    ];
    
    const isGeneralQuestion = !meetingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    let systemPrompt;
    let apiUrl;
    let headers;
    let model;
    let apiKey;

    if (isGeneralQuestion || !context) {
      // Use OpenRouter for general questions
      systemPrompt = `You are a helpful AI assistant. Answer the user's question using your general knowledge. Be helpful, accurate, and conversational.`;
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      apiKey = openRouterApiKey;
      model = 'meta-llama/llama-3.1-8b-instruct:free';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Meeting AI Assistant'
      };
    } else {
      // Use Groq for meeting-related questions
      if (!groqApiKey) {
        throw new Error('GROQ API key not found');
      }
      
      systemPrompt = `You are a helpful AI assistant with access to meeting transcription data. 
         Use the following context to answer the user's question about the meeting:
         
         MEETING CONTEXT:
         ${context}
         
         Provide helpful insights based on the meeting content. Be specific and reference the actual conversation when possible.`;
      
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      apiKey = groqApiKey;
      model = 'llama3-70b-8192';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log(`Used ${isGeneralQuestion ? 'OpenRouter' : 'Groq'} for question: ${message.substring(0, 50)}...`);

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
