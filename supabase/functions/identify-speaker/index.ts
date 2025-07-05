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
    const { imageBlob, meetingId } = await req.json();

    if (!imageBlob || !Array.isArray(imageBlob)) {
      throw new Error('Invalid image data provided');
    }

    const huggingFaceApiKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!huggingFaceApiKey) {
      throw new Error('HUGGINGFACE_API_KEY not found in environment variables');
    }

    console.log('Processing speaker identification:', { 
      imageDataLength: imageBlob.length,
      meetingId
    });

    // Convert array back to Uint8Array
    const imageData = new Uint8Array(imageBlob);

    try {
      // Use Hugging Face face detection model
      const faceDetectionResponse = await fetch('https://api-inference.huggingface.co/models/facebook/detr-resnet-50', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceApiKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageData,
      });

      let detectedFaces = [];
      if (faceDetectionResponse.ok) {
        const faceData = await faceDetectionResponse.json();
        detectedFaces = faceData.filter((detection: any) => 
          detection.label === 'person' && detection.score > 0.5
        );
      }

      // If faces detected, try to identify or create speaker profile
      if (detectedFaces.length > 0) {
        const mainFace = detectedFaces.reduce((prev: any, current: any) => 
          (current.score > prev.score) ? current : prev
        );

        // Generate speaker profile based on detection
        const speakerProfile = {
          id: `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: await generateSpeakerName(meetingId, detectedFaces.length),
          confidence: mainFace.score,
          faceDetected: true,
          timestamp: Date.now()
        };

        console.log('Speaker identified:', speakerProfile);

        return new Response(JSON.stringify({ 
          speaker: speakerProfile,
          facesDetected: detectedFaces.length,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } else {
        // No clear face detection, return generic speaker
        const fallbackSpeaker = {
          id: `speaker_${Date.now()}`,
          name: await generateSpeakerName(meetingId, 1),
          confidence: 0.6,
          faceDetected: false,
          timestamp: Date.now()
        };

        return new Response(JSON.stringify({ 
          speaker: fallbackSpeaker,
          facesDetected: 0,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

    } catch (huggingFaceError) {
      console.error('Hugging Face API error:', huggingFaceError);
      
      // Fallback speaker identification
      const fallbackSpeaker = {
        id: `speaker_fallback_${Date.now()}`,
        name: await generateSpeakerName(meetingId, 1),
        confidence: 0.5,
        faceDetected: false,
        timestamp: Date.now(),
        fallback: true
      };

      return new Response(JSON.stringify({ 
        speaker: fallbackSpeaker,
        facesDetected: 0,
        success: true,
        warning: 'Used fallback speaker identification'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in identify-speaker function:', error);
    
    // Even on error, return a basic speaker to keep the system working
    const errorSpeaker = {
      id: `speaker_error_${Date.now()}`,
      name: 'Unknown Speaker',
      confidence: 0.3,
      faceDetected: false,
      timestamp: Date.now(),
      error: true
    };

    return new Response(JSON.stringify({ 
      speaker: errorSpeaker,
      facesDetected: 0,
      success: false,
      error: 'Speaker identification failed, using fallback'
    }), {
      status: 200, // Return 200 to not break the client
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSpeakerName(meetingId: string, speakerCount: number): Promise<string> {
  // In a real implementation, you might want to:
  // 1. Check existing speakers for this meeting
  // 2. Use face recognition to match with known speakers
  // 3. Generate meaningful names based on context
  
  const speakerNames = [
    'Main Speaker',
    'Presenter',
    'Participant A',
    'Participant B', 
    'Guest Speaker',
    'Team Member',
    'Attendee',
    'Contributor'
  ];

  // Generate a more contextual name
  if (speakerCount === 1) {
    return 'Main Speaker';
  } else if (speakerCount === 2) {
    return 'Second Speaker';
  } else {
    return `Speaker ${speakerCount}`;
  }
}
