
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const groqApiKey = Deno.env.get('GROQ_API_KEY');
const cyberAlphaKey = Deno.env.get('Cyber_Alpha_API_Key');

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

    if (!groqApiKey && !cyberAlphaKey) {
      throw new Error('No AI API keys found');
    }

    // Determine if question is meeting-related based on context
    const isMeetingRelated = context && context.trim().length > 0;
    let aiResponse = '';

    if (isMeetingRelated && groqApiKey) {
      // Use Groq for meeting-related questions with context
      const systemPrompt = `You are a helpful AI assistant with access to meeting transcription data. 
         Analyze the following meeting context and provide insights:
         
         MEETING TRANSCRIPTION:
         ${context}
         
         Answer the user's question based on this meeting content. Be specific, reference actual speakers and conversations, and provide actionable insights.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      aiResponse = data.choices[0].message.content;
      console.log(`Used Groq for meeting-related question`);

    } else if (cyberAlphaKey) {
      // Use Cyber Alpha for general questions
      const response = await fetch('https://api.cyberalpha.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cyberAlphaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions.' 
            },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cyber Alpha API error: ${response.status}`);
      }

      const data = await response.json();
      aiResponse = data.choices[0].message.content;
      console.log(`Used Cyber Alpha for general question`);

    } else {
      // Fallback to Groq for general questions if Cyber Alpha is not available
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful AI assistant. Provide clear and helpful responses.' 
            },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      aiResponse = data.choices[0].message.content;
      console.log(`Used Groq fallback for general question`);
    }

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
