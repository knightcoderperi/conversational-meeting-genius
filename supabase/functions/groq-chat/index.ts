
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

    console.log('Processing request:', { 
      messageLength: message.length, 
      contextLength: context?.length || 0,
      hasContext: !!context 
    });

    // Prepare the prompt with meeting context
    const systemPrompt = `You are an AI assistant that analyzes meeting transcriptions and answers questions about them. 

Meeting Transcription:
${context || 'No meeting transcription available yet.'}

Instructions:
- Answer questions based ONLY on the meeting transcription provided above
- If the transcription is empty or the question cannot be answered from it, clearly state that
- Be concise, helpful, and accurate
- Extract specific information, provide summaries, action items, or analysis as requested
- Focus on the actual content discussed in the meeting
- If asked about speakers, refer to them as mentioned in the transcription`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Groq response received:', { 
      hasChoices: !!data.choices, 
      choicesLength: data.choices?.length 
    });

    const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in groq-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Please check the server logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
