
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
    const { message, context } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    console.log('Processing Ultimate AI request:', { 
      messageLength: message.length, 
      contextLength: context?.length || 0,
      hasContext: !!context 
    });

    // Determine if this is a meeting-related query or general query
    const isMeetingQuery = context && context.trim().length > 0;
    
    let systemPrompt = '';
    
    if (isMeetingQuery) {
      systemPrompt = `You are an advanced AI assistant that specializes in analyzing meeting transcriptions and providing comprehensive insights.

Meeting Transcription:
${context}

Instructions:
- Analyze the meeting transcription thoroughly and provide detailed, actionable insights
- Extract specific information, provide summaries, action items, decisions, and analysis as requested
- Identify key themes, patterns, and important discussion points
- If asked about speakers, refer to them exactly as mentioned in the transcription
- Provide structured responses with clear headings and bullet points when appropriate
- Be comprehensive yet concise, focusing on the most valuable information
- If the transcription seems incomplete or the question cannot be fully answered, clearly state that and provide what insights you can`;
    } else {
      systemPrompt = `You are an expert AI assistant with comprehensive knowledge across all domains. You can:

- Write detailed, well-structured articles on any topic
- Provide expert advice and best practices
- Explain complex concepts in an accessible way
- Offer practical tips and actionable insights
- Create comprehensive guides and tutorials
- Analyze trends and provide strategic recommendations

Instructions:
- Provide thorough, accurate, and helpful responses
- Structure your responses with clear headings and sections when appropriate
- Include practical examples and actionable advice
- Be comprehensive yet accessible
- If writing an article, include an engaging introduction, well-organized body with subheadings, and a compelling conclusion
- Always aim to provide maximum value and actionable insights`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Use the more powerful model for better responses
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: isMeetingQuery ? 0.3 : 0.7, // Lower temperature for meeting analysis, higher for creative content
        max_tokens: 2000, // Increased for more comprehensive responses
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Ultimate AI response received:', { 
      hasChoices: !!data.choices, 
      choicesLength: data.choices?.length,
      queryType: isMeetingQuery ? 'meeting' : 'general'
    });

    const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ultimate groq-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Please check the server logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
