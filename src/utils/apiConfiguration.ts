
export interface APIConfiguration {
  assemblyai: {
    apiKey: string;
    endpoint: string;
  };
}

export class TranscriptionAPIManager {
  private config: APIConfiguration = {
    assemblyai: {
      apiKey: '888ba8002c7a46499cf80c50a29c74fd',
      endpoint: 'https://api.assemblyai.com/v2'
    }
  };

  private detectedNames: string[] = [];

  setDetectedNames(names: string[]) {
    this.detectedNames = names;
    console.log('🎯 Updated detected names:', names);
  }

  async transcribeAudio(audioBase64: string): Promise<{ text: string; confidence: number; speakers?: any[] }> {
    return this.transcribeWithAssemblyAI(audioBase64);
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
      speakers: transcript.utterances?.map((utterance: any, index: number) => {
        // Try to map to real names from detected names
        const speakerIndex = parseInt(utterance.speaker) - 1;
        const realName = this.detectedNames[speakerIndex] || `Speaker ${utterance.speaker}`;
        
        return {
          text: utterance.text,
          speaker: realName,
          confidence: utterance.confidence,
          start: utterance.start,
          end: utterance.end,
          speakerId: utterance.speaker
        };
      })
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
