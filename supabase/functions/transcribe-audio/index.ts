import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Audio = btoa(String.fromCharCode(...uint8Array));

    // First, upload the audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': Deno.env.get('ASSEMBLY_AI'),
      },
      body: uint8Array,
    });

    const { upload_url } = await uploadResponse.json();

    // Then, submit for transcription with speaker diarization
    const transcribeResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': Deno.env.get('ASSEMBLY_AI'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speakers_expected: 10,
        punctuate: true,
        format_text: true,
        boost_param: 'high',
        language_detection: true
      }),
    });

    const transcriptRequest = await transcribeResponse.json();

    // Poll for completion
    let transcript;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptRequest.id}`, {
        headers: {
          'authorization': Deno.env.get('ASSEMBLY_AI'),
        },
      });
      transcript = await statusResponse.json();
    } while (transcript.status !== 'completed' && transcript.status !== 'error');

    if (transcript.status === 'error') {
      throw new Error('AssemblyAI transcription failed');
    }

    // Process speakers with real names
    const speakers = transcript.utterances?.map((utterance: any) => ({
      text: utterance.text,
      speaker: `Speaker ${utterance.speaker}`,
      confidence: utterance.confidence,
      start: utterance.start,
      end: utterance.end,
      speakerId: utterance.speaker
    })) || [];

    return new Response(
      JSON.stringify({
        text: transcript.text || '',
        confidence: transcript.confidence || 0.8,
        speakers: speakers
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});