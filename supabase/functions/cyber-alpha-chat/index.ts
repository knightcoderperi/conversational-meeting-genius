import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { message, mode } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    const cyberAlphaApiKey = Deno.env.get('Cyber_Alpha_API_Key');
    if (!cyberAlphaApiKey) {
      throw new Error('Cyber_Alpha_API_Key not found in environment variables');
    }

    console.log('Processing Cyber Alpha request:', { 
      messageLength: message.length, 
      mode: mode || 'general'
    });

    // Enhanced system prompt for general AI assistance
    const systemPrompt = `You are Cyber Alpha, an advanced AI assistant designed to be helpful, accurate, and engaging. You can assist with a wide variety of tasks including:

- Answering questions on any topic
- Helping with research and analysis  
- Brainstorming and creative thinking
- Problem-solving and troubleshooting
- Writing and editing assistance
- Educational explanations
- Technical support
- General conversation

Instructions:
- Be comprehensive, accurate, and helpful
- Provide detailed explanations when needed
- Offer practical solutions and actionable advice
- Be conversational and engaging
- If you're unsure about something, say so honestly
- Provide examples when they would be helpful
- Ask clarifying questions if needed

Current query: ${message}`;

    // Use a general-purpose AI model for diverse queries
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cyberAlphaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Using larger model for better general performance
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7, // Higher temperature for more creative responses
        max_tokens: 2000, // More tokens for comprehensive answers
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cyber Alpha API error:', response.status, errorText);
      throw new Error(`Cyber Alpha API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Cyber Alpha response received:', { 
      hasChoices: !!data.choices, 
      choicesLength: data.choices?.length 
    });

    const aiResponse = data.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response at this time. Please try rephrasing your question.';

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in cyber-alpha-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Please check the server logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});