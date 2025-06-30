
export class MultiSpeakerAudioCapture {
  private audioContext: AudioContext | null = null;
  private mixedStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private gainNodes: Map<string, GainNode> = new Map();

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async setupCompleteAudioCapture(): Promise<MediaStream> {
    try {
      console.log('🎤 Setting up complete multi-speaker audio capture...');

      // 1. Capture high-quality microphone audio
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          sampleSize: 16
        }
      });

      // 2. Capture system audio (for remote speakers)
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
          channelCount: 2,
          autoGainControl: false
        },
        video: false
      });

      // 3. Create mixed audio stream
      this.mixedStream = this.createMixedAudioStream();
      
      console.log('✅ Multi-speaker audio capture ready!');
      return this.mixedStream;

    } catch (error) {
      console.error('❌ Audio capture setup failed:', error);
      throw new Error(`Audio capture failed: ${error.message}`);
    }
  }

  private createMixedAudioStream(): MediaStream {
    if (!this.audioContext || !this.micStream || !this.systemStream) {
      throw new Error('Audio context or streams not initialized');
    }

    const destination = this.audioContext.createMediaStreamDestination();
    
    // Connect microphone with gain control
    const micSource = this.audioContext.createMediaStreamSource(this.micStream);
    const micGain = this.audioContext.createGain();
    micGain.gain.value = 1.0; // Full volume for local mic
    micSource.connect(micGain);
    micGain.connect(destination);
    this.gainNodes.set('microphone', micGain);
    
    // Connect system audio with boost for remote speakers
    const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
    const systemGain = this.audioContext.createGain();
    systemGain.gain.value = 1.2; // Boost remote speakers
    systemSource.connect(systemGain);
    systemGain.connect(destination);
    this.gainNodes.set('system', systemGain);
    
    return destination.stream;
  }

  adjustGain(source: 'microphone' | 'system', volume: number): void {
    const gainNode = this.gainNodes.get(source);
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(2, volume));
      console.log(`🔊 ${source} volume adjusted to ${volume}`);
    }
  }

  getAudioLevel(): number {
    if (!this.audioContext) return 0;
    
    // Simple audio level detection
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255;
  }

  cleanup(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
    }
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.gainNodes.clear();
    console.log('🧹 Audio capture cleaned up');
  }
}
