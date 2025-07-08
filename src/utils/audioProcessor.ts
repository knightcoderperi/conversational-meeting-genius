
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioDataCallback: ((audioData: Float32Array) => void) | null = null;

  constructor(onAudioData: (audioData: Float32Array) => void) {
    this.onAudioDataCallback = onAudioData;
  }

  async startProcessing(stream: MediaStream) {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Get audio tracks from the stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream([audioTracks[0]]);
        this.microphone = this.audioContext.createMediaStreamSource(audioStream);
        
        // Create processor for real-time audio data
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          if (this.onAudioDataCallback) {
            this.onAudioDataCallback(new Float32Array(inputData));
          }
        };

        this.microphone.connect(this.analyser);
        this.microphone.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
      }
    } catch (error) {
      console.error('Error starting audio processing:', error);
      throw error;
    }
  }

  getVolumeLevel(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255;
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Convert audio data to base64 for API transmission
  encodeAudioData(float32Array: Float32Array): string {
    // Convert to 16-bit PCM
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }
}

// Speaker identification utility
export class SpeakerIdentifier {
  private speakers: Map<string, { name: string; features: number[] }> = new Map();
  private currentSpeaker = 'Speaker 1';
  private speakerCount = 1;

  identifySpeaker(audioFeatures: Float32Array): string {
    // Simple speaker identification based on voice characteristics
    const features = this.extractVoiceFeatures(audioFeatures);
    
    // Find closest matching speaker or create new one
    let closestSpeaker = null;
    let minDistance = Infinity;
    
    for (const [speakerId, speaker] of this.speakers) {
      const distance = this.calculateDistance(features, speaker.features);
      if (distance < minDistance && distance < 0.3) { // Threshold for same speaker
        minDistance = distance;
        closestSpeaker = speakerId;
      }
    }
    
    if (closestSpeaker) {
      this.currentSpeaker = this.speakers.get(closestSpeaker)!.name;
    } else {
      // New speaker detected
      this.speakerCount++;
      const newSpeakerId = `speaker_${this.speakerCount}`;
      const newSpeakerName = `Speaker ${this.speakerCount}`;
      
      this.speakers.set(newSpeakerId, {
        name: newSpeakerName,
        features
      });
      
      this.currentSpeaker = newSpeakerName;
    }
    
    return this.currentSpeaker;
  }

  private extractVoiceFeatures(audioData: Float32Array): number[] {
    // Extract basic voice features (pitch, energy, etc.)
    const features = [];
    
    // Energy
    const energy = audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length;
    features.push(energy);
    
    // Zero crossing rate (rough pitch indicator)
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    features.push(zeroCrossings / audioData.length);
    
    return features;
  }

  private calculateDistance(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) return Infinity;
    
    let sum = 0;
    for (let i = 0; i < features1.length; i++) {
      sum += Math.pow(features1[i] - features2[i], 2);
    }
    return Math.sqrt(sum);
  }

  getAllSpeakers(): string[] {
    return Array.from(this.speakers.values()).map(speaker => speaker.name);
  }
}
