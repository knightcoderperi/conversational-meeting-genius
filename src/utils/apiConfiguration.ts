
export interface APIConfiguration {
  openai?: {
    apiKey: string;
    model: string;
  };
  google?: {
    apiKey: string;
    endpoint: string;
  };
  assemblyai?: {
    apiKey: string;
    endpoint: string;
  };
  azure?: {
    apiKey: string;
    region: string;
    endpoint: string;
  };
}

export class TranscriptionAPIManager {
  private config: APIConfiguration = {};
  private selectedAPI: 'openai' | 'google' | 'assemblyai' | 'azure' = 'openai';

  setConfiguration(config: APIConfiguration): void {
    this.config = config;
  }

  setSelectedAPI(api: 'openai' | 'google' | 'assemblyai' | 'azure'): void {
    this.selectedAPI = api;
  }

  async transcribeAudio(audioBase64: string): Promise<{ text: string; confidence: number; speakers?: any[] }> {
    switch (this.selectedAPI) {
      case 'openai':
        return this.transcribeWithOpenAI(audioBase64);
      case 'google':
        return this.transcribeWithGoogle(audioBase64);
      case 'assemblyai':
        return this.transcribeWithAssemblyAI(audioBase64);
      case 'azure':
        return this.transcribeWithAzure(audioBase64);
      default:
        throw new Error('No transcription API configured');
    }
  }

  private async transcribeWithOpenAI(audioBase64: string): Promise<{ text: string; confidence: number }> {
    if (!this.config.openai?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Convert base64 to blob for OpenAI API
    const audioBlob = this.base64ToBlob(audioBase64, 'audio/webm');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.openai.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      text: result.text || '',
      confidence: 0.9 // OpenAI doesn't provide confidence scores
    };
  }

  private async transcribeWithGoogle(audioBase64: string): Promise<{ text: string; confidence: number; speakers?: any[] }> {
    if (!this.config.google?.apiKey) {
      throw new Error('Google API key not configured');
    }

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableSpeakerDiarization: true,
        diarizationSpeakerCount: 4,
        model: 'latest_long'
      },
      audio: {
        content: audioBase64
      }
    };

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${this.config.google.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Google Speech API error: ${response.statusText}`);
    }

    const result = await response.json();
    const alternatives = result.results?.[0]?.alternatives?.[0];
    
    return {
      text: alternatives?.transcript || '',
      confidence: alternatives?.confidence || 0.8,
      speakers: result.results?.[0]?.alternatives?.[0]?.words?.map((word: any) => ({
        word: word.word,
        speakerTag: word.speakerTag,
        startTime: word.startTime,
        endTime: word.endTime
      }))
    };
  }

  private async transcribeWithAssemblyAI(audioBase64: string): Promise<{ text: string; confidence: number; speakers?: any[] }> {
    if (!this.config.assemblyai?.apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // First, upload the audio
    const audioBlob = this.base64ToBlob(audioBase64, 'audio/webm');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': this.config.assemblyai.apiKey,
      },
      body: audioBlob,
    });

    const { upload_url } = await uploadResponse.json();

    // Then, submit for transcription with speaker diarization
    const transcribeResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': this.config.assemblyai.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speakers_expected: 4
      }),
    });

    const transcriptRequest = await transcribeResponse.json();

    // Poll for completion
    let transcript;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptRequest.id}`, {
        headers: {
          'authorization': this.config.assemblyai.apiKey,
        },
      });
      transcript = await statusResponse.json();
    } while (transcript.status !== 'completed' && transcript.status !== 'error');

    if (transcript.status === 'error') {
      throw new Error('AssemblyAI transcription failed');
    }

    return {
      text: transcript.text || '',
      confidence: transcript.confidence || 0.8,
      speakers: transcript.utterances?.map((utterance: any) => ({
        text: utterance.text,
        speaker: `Speaker ${utterance.speaker}`,
        confidence: utterance.confidence,
        start: utterance.start,
        end: utterance.end
      }))
    };
  }

  private async transcribeWithAzure(audioBase64: string): Promise<{ text: string; confidence: number }> {
    if (!this.config.azure?.apiKey || !this.config.azure?.region) {
      throw new Error('Azure Speech API key or region not configured');
    }

    const audioBlob = this.base64ToBlob(audioBase64, 'audio/wav');
    
    const response = await fetch(
      `https://${this.config.azure.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.azure.apiKey,
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      }
    );

    if (!response.ok) {
      throw new Error(`Azure Speech API error: ${response.statusText}`);
    }

    const result = await response.json();
    const nbest = result.NBest?.[0];
    
    return {
      text: nbest?.Display || '',
      confidence: nbest?.Confidence || 0.8
    };
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Export singleton instance
export const transcriptionAPI = new TranscriptionAPIManager();

// Setup instructions
export const SETUP_INSTRUCTIONS = {
  openai: {
    name: 'OpenAI Whisper',
    steps: [
      '1. Go to https://platform.openai.com/api-keys',
      '2. Create a new API key',
      '3. Copy the key and paste it in the configuration',
      '4. Note: Costs $0.006 per minute'
    ],
    example: `
// Setup OpenAI
import { transcriptionAPI } from './apiConfiguration';

transcriptionAPI.setConfiguration({
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY_HERE',
    model: 'whisper-1'
  }
});
transcriptionAPI.setSelectedAPI('openai');
    `
  },
  google: {
    name: 'Google Speech-to-Text',
    steps: [
      '1. Go to Google Cloud Console',
      '2. Enable Speech-to-Text API',
      '3. Create an API key',
      '4. Note: 60 minutes free + $300 credit'
    ],
    example: `
// Setup Google
transcriptionAPI.setConfiguration({
  google: {
    apiKey: 'YOUR_GOOGLE_API_KEY_HERE',
    endpoint: 'https://speech.googleapis.com/v1/speech:recognize'
  }
});
transcriptionAPI.setSelectedAPI('google');
    `
  },
  assemblyai: {
    name: 'AssemblyAI',
    steps: [
      '1. Sign up at https://www.assemblyai.com/',
      '2. Get your API key from dashboard',
      '3. Free tier available',
      '4. Best speaker diarization accuracy'
    ],
    example: `
// Setup AssemblyAI
transcriptionAPI.setConfiguration({
  assemblyai: {
    apiKey: 'YOUR_ASSEMBLYAI_API_KEY_HERE',
    endpoint: 'https://api.assemblyai.com/v2'
  }
});
transcriptionAPI.setSelectedAPI('assemblyai');
    `
  },
  azure: {
    name: 'Azure Speech Services',
    steps: [
      '1. Create Azure account',
      '2. Create Speech Services resource',
      '3. Get API key and region',
      '4. Note: 5 hours/month free'
    ],
    example: `
// Setup Azure
transcriptionAPI.setConfiguration({
  azure: {
    apiKey: 'YOUR_AZURE_API_KEY_HERE',
    region: 'eastus', // Your Azure region
    endpoint: 'https://eastus.api.cognitive.microsoft.com/'
  }
});
transcriptionAPI.setSelectedAPI('azure');
    `
  }
};
