import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, audioData, meetingId, contextSegments } = await req.json();

    const huggingFaceApiKey = Deno.env.get('HUGGINGFACE_API_KEY');
    const assemblyAiApiKey = Deno.env.get('ASSEMBLY_AI');

    console.log('Enhancing transcription segment:', { 
      segmentId: segment.id,
      hasAudioData: !!audioData,
      contextSegmentsCount: contextSegments?.length || 0
    });

    let enhancedSegment = { ...segment };

    // Enhance with Assembly AI for better accuracy
    if (assemblyAiApiKey && audioData) {
      try {
        const audioAnalysisResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            'Authorization': assemblyAiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_data: audioData,
            speaker_labels: true,
            auto_highlights: true,
            sentiment_analysis: true,
            entity_detection: true,
          }),
        });

        if (audioAnalysisResponse.ok) {
          const analysisData = await audioAnalysisResponse.json();
          
          // Update speaker information if available
          if (analysisData.speaker_labels && analysisData.speaker_labels.length > 0) {
            const speakerLabel = analysisData.speaker_labels[0];
            enhancedSegment.speaker = `Speaker ${speakerLabel.speaker}`;
          }

          // Update confidence if available
          if (analysisData.confidence) {
            enhancedSegment.confidence = Math.max(enhancedSegment.confidence, analysisData.confidence);
          }

          // Add sentiment and entity information
          enhancedSegment.sentiment = analysisData.sentiment_analysis_results?.[0]?.sentiment;
          enhancedSegment.entities = analysisData.entities;
        }
      } catch (error) {
        console.error('Assembly AI enhancement error:', error);
      }
    }

    // Use Hugging Face for additional text processing
    if (huggingFaceApiKey) {
      try {
        // Sentiment analysis
        const sentimentResponse = await fetch('https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: segment.text
          }),
        });

        if (sentimentResponse.ok) {
          const sentimentData = await sentimentResponse.json();
          if (sentimentData && sentimentData[0]) {
            enhancedSegment.sentimentScore = sentimentData[0];
          }
        }

        // Named Entity Recognition
        const nerResponse = await fetch('https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: segment.text
          }),
        });

        if (nerResponse.ok) {
          const nerData = await nerResponse.json();
          enhancedSegment.namedEntities = nerData;
        }

      } catch (error) {
        console.error('Hugging Face enhancement error:', error);
      }
    }

    // Analyze context for better speaker identification
    if (contextSegments && contextSegments.length > 0) {
      const speakerPatterns = analyzeSpeakerPatterns(contextSegments, segment);
      if (speakerPatterns.suggestedSpeaker) {
        enhancedSegment.speaker = speakerPatterns.suggestedSpeaker;
        enhancedSegment.speakerConfidence = speakerPatterns.confidence;
      }
    }

    console.log('Transcription enhanced successfully:', {
      originalSpeaker: segment.speaker,
      enhancedSpeaker: enhancedSegment.speaker,
      hasEnhancements: JSON.stringify(enhancedSegment) !== JSON.stringify(segment)
    });

    return new Response(JSON.stringify({ 
      enhancedSegment,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhance-transcription function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      enhancedSegment: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeSpeakerPatterns(contextSegments: any[], currentSegment: any) {
  // Simple pattern analysis based on speech patterns and timing
  const recentSegments = contextSegments.slice(-3); // Last 3 segments
  
  if (recentSegments.length === 0) {
    return { suggestedSpeaker: null, confidence: 0 };
  }

  // Check if the current segment continues from the same speaker
  const lastSegment = recentSegments[recentSegments.length - 1];
  const timeDiff = new Date(currentSegment.timestamp).getTime() - new Date(lastSegment.timestamp).getTime();
  
  // If less than 5 seconds gap, likely same speaker
  if (timeDiff < 5000) {
    return {
      suggestedSpeaker: lastSegment.speaker,
      confidence: 0.8
    };
  }

  // Analyze speech patterns (simple heuristic)
  const avgWordsPerSegment = currentSegment.text.split(' ').length;
  const lastSpeakerAvgWords = recentSegments
    .filter(s => s.speaker === lastSegment.speaker)
    .reduce((sum, s) => sum + s.text.split(' ').length, 0) / recentSegments.filter(s => s.speaker === lastSegment.speaker).length;

  // If similar word count pattern, likely same speaker
  if (Math.abs(avgWordsPerSegment - lastSpeakerAvgWords) < 3) {
    return {
      suggestedSpeaker: lastSegment.speaker,
      confidence: 0.6
    };
  }

  return { suggestedSpeaker: null, confidence: 0 };
}