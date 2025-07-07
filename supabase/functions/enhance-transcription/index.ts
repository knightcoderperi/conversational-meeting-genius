import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { audio, meetingId, enableSpeakerDiarization, realtime } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    const assemblyApiKey = Deno.env.get('ASSEMBLY_AI');
    if (!assemblyApiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    console.log('Processing audio chunk for multi-speaker transcription...');

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyApiKey,
        'content-type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${await uploadResponse.text()}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Start transcription with speaker diarization
    const transcriptionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: enableSpeakerDiarization || true,
        auto_highlights: true,
        sentiment_analysis: true,
        entity_detection: true,
        language_detection: true,
        punctuate: true,
        format_text: true
      })
    });

    if (!transcriptionResponse.ok) {
      throw new Error(`Transcription request failed: ${await transcriptionResponse.text()}`);
    }

    const transcriptionJob = await transcriptionResponse.json();
    
    // Poll for completion (for real-time, we might implement streaming later)
    let result = transcriptionJob;
    let attempts = 0;
    const maxAttempts = realtime ? 60 : 120; // Longer timeout for unlimited transcription

    while (result.status !== 'completed' && result.status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, realtime ? 1000 : 2000));
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${result.id}`, {
        headers: { 'authorization': assemblyApiKey }
      });
      
      result = await statusResponse.json();
      attempts++;
    }

    if (result.status === 'error') {
      throw new Error(`Transcription failed: ${result.error}`);
    }

    if (result.status !== 'completed') {
      // For real-time, return partial results if available
      if (realtime && result.status === 'processing') {
        return new Response(
          JSON.stringify({
            text: "Processing...",
            segments: [],
            status: 'processing'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Transcription timeout');
    }

    // Process the transcription results with speaker diarization
    const segments = [];
    
    if (result.utterances && result.utterances.length > 0) {
      // Use utterances for speaker-separated segments
      for (const utterance of result.utterances) {
        segments.push({
          speaker: `Speaker ${utterance.speaker}`,
          text: utterance.text,
          confidence: utterance.confidence,
          start_time: utterance.start / 1000, // Convert to seconds
          end_time: utterance.end / 1000,
          is_final: true
        });
      }
    } else if (result.words && result.words.length > 0) {
      // Fallback to word-level results
      let currentSpeaker = 'A';
      let currentText = '';
      let startTime = result.words[0].start / 1000;
      
      for (let i = 0; i < result.words.length; i++) {
        const word = result.words[i];
        const speaker = word.speaker || 'A';
        
        if (speaker !== currentSpeaker && currentText.trim()) {
          segments.push({
            speaker: `Speaker ${currentSpeaker}`,
            text: currentText.trim(),
            confidence: word.confidence || 0.9,
            start_time: startTime,
            end_time: word.start / 1000,
            is_final: true
          });
          
          currentText = word.text + ' ';
          startTime = word.start / 1000;
          currentSpeaker = speaker;
        } else {
          currentText += word.text + ' ';
        }
      }
      
      // Add final segment
      if (currentText.trim()) {
        segments.push({
          speaker: `Speaker ${currentSpeaker}`,
          text: currentText.trim(),
          confidence: 0.9,
          start_time: startTime,
          end_time: result.words[result.words.length - 1].end / 1000,
          is_final: true
        });
      }
    } else if (result.text) {
      // Basic fallback without speaker separation
      segments.push({
        speaker: "Speaker A",
        text: result.text,
        confidence: result.confidence || 0.9,
        start_time: 0,
        end_time: result.audio_duration || 0,
        is_final: true
      });
    }

    console.log(`Processed ${segments.length} speaker segments`);

    return new Response(
      JSON.stringify({
        text: result.text || '',
        segments: segments,
        confidence: result.confidence || 0.9,
        speakers_detected: result.utterances ? result.utterances.length : 1,
        status: 'completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});