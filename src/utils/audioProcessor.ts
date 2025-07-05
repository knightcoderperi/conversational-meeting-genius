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
}

// Improved Speaker identification utility
export class SpeakerIdentifier {
  private currentSpeaker = 'Main Speaker';
  private lastSpeechTime = 0;
  private silenceThreshold = 2000; // 2 seconds of silence before considering new speaker
  
  identifySpeaker(audioFeatures: Float32Array): string {
    const currentTime = Date.now();
    const hasAudio = this.detectSpeech(audioFeatures);
    
    if (hasAudio) {
      this.lastSpeechTime = currentTime;
      return this.currentSpeaker;
    }
    
    // If there's been silence for too long, it might be a new speaker next time
    if (currentTime - this.lastSpeechTime > this.silenceThreshold) {
      // Reset for potential new speaker detection
      // But for now, we'll keep it as the same speaker since it's likely the same person
      return this.currentSpeaker;
    }
    
    return this.currentSpeaker;
  }

  private detectSpeech(audioData: Float32Array): boolean {
    // Calculate RMS (Root Mean Square) to detect speech
    const rms = Math.sqrt(audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length);
    return rms > 0.01; // Threshold for speech detection
  }

  getCurrentSpeaker(): string {
    return this.currentSpeaker;
  }

  // Method to manually set speaker name if needed
  setSpeakerName(name: string): void {
    this.currentSpeaker = name;
  }
}
