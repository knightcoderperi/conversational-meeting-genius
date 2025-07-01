
export class MultiSpeakerAudioCapture {
  private audioContext: AudioContext | null = null;
  private mixedStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private gainNodes: Map<string, GainNode> = new Map();
  private analyserNodes: Map<string, AnalyserNode> = new Map();

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async setupCompleteAudioCapture(): Promise<MediaStream> {
    try {
      console.log('🎤 Setting up complete multi-speaker audio capture...');

      // 1. Capture high-quality microphone audio (local user)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          sampleSize: 16,
          latency: 0.01 // Low latency for real-time
        }
      });

      // 2. Capture complete system audio (ALL remote speakers)
      // This captures the entire audio output from the system
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false, // Keep original remote audio
          noiseSuppression: false, // Preserve all remote voices
          sampleRate: 48000,
          channelCount: 2,
          autoGainControl: false, // Don't modify remote audio levels
          suppressLocalAudioPlayback: false // Ensure we capture everything
        },
        video: false // We only need audio from this stream
      });

      // 3. Create advanced mixed audio stream with complete capture
      this.mixedStream = this.createAdvancedMixedAudioStream();
      
      console.log('✅ Complete multi-speaker audio capture ready!');
      console.log(`📊 Audio tracks: ${this.mixedStream.getAudioTracks().length}`);
      console.log(`🎚️ Sample rate: ${this.audioContext?.sampleRate}Hz`);
      
      return this.mixedStream;

    } catch (error) {
      console.error('❌ Complete audio capture setup failed:', error);
      
      // Provide helpful error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Audio capture permissions denied. Please allow microphone and system audio access.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('Audio devices not found. Please ensure you have a microphone connected.');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Complete audio capture not supported in this browser. Try Chrome or Edge.');
      }
      
      throw new Error(`Complete audio capture failed: ${error.message}`);
    }
  }

  private createAdvancedMixedAudioStream(): MediaStream {
    if (!this.audioContext || !this.micStream || !this.systemStream) {
      throw new Error('Audio context or streams not initialized');
    }

    const destination = this.audioContext.createMediaStreamDestination();
    
    // Process local microphone with echo cancellation
    const micSource = this.audioContext.createMediaStreamSource(this.micStream);
    const micGain = this.audioContext.createGain();
    const micAnalyser = this.audioContext.createAnalyser();
    
    // Configure microphone processing
    micGain.gain.value = 1.0; // Full volume for local mic
    micAnalyser.fftSize = 2048;
    micAnalyser.smoothingTimeConstant = 0.8;
    
    micSource.connect(micGain);
    micGain.connect(micAnalyser);
    micAnalyser.connect(destination);
    
    this.gainNodes.set('microphone', micGain);
    this.analyserNodes.set('microphone', micAnalyser);
    
    // Process complete system audio (all remote speakers)
    const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
    const systemGain = this.audioContext.createGain();
    const systemAnalyser = this.audioContext.createAnalyser();
    
    // Configure system audio processing for complete capture
    systemGain.gain.value = 1.3; // Slight boost for remote speakers
    systemAnalyser.fftSize = 2048;
    systemAnalyser.smoothingTimeConstant = 0.8;
    
    systemSource.connect(systemGain);
    systemGain.connect(systemAnalyser);
    systemAnalyser.connect(destination);
    
    this.gainNodes.set('system', systemGain);
    this.analyserNodes.set('system', systemAnalyser);
    
    console.log('🎛️ Advanced audio mixing configured:');
    console.log(`  - Microphone: ${this.micStream.getAudioTracks().length} tracks`);
    console.log(`  - System audio: ${this.systemStream.getAudioTracks().length} tracks`);
    console.log(`  - Mixed output: ${destination.stream.getAudioTracks().length} tracks`);
    
    return destination.stream;
  }

  adjustGain(source: 'microphone' | 'system', volume: number): void {
    const gainNode = this.gainNodes.get(source);
    if (gainNode) {
      const clampedVolume = Math.max(0, Math.min(3, volume)); // Allow up to 3x boost
      gainNode.gain.value = clampedVolume;
      console.log(`🔊 ${source} volume adjusted to ${Math.round(clampedVolume * 100)}%`);
    }
  }

  getAudioLevel(source: 'microphone' | 'system' = 'system'): number {
    const analyser = this.analyserNodes.get(source);
    if (!analyser) return 0;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS (Root Mean Square) for better audio level representation
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    return Math.min(rms / 255, 1); // Normalize to 0-1
  }

  getAllAudioLevels(): { microphone: number; system: number } {
    return {
      microphone: this.getAudioLevel('microphone'),
      system: this.getAudioLevel('system')
    };
  }

  getStreamInfo(): { 
    micTracks: number; 
    systemTracks: number; 
    outputTracks: number;
    sampleRate: number;
  } {
    return {
      micTracks: this.micStream?.getAudioTracks().length || 0,
      systemTracks: this.systemStream?.getAudioTracks().length || 0,
      outputTracks: this.mixedStream?.getAudioTracks().length || 0,
      sampleRate: this.audioContext?.sampleRate || 0
    };
  }

  cleanup(): void {
    console.log('🧹 Starting complete audio capture cleanup...');
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🎤 Microphone track stopped: ${track.kind}`);
      });
      this.micStream = null;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🔊 System audio track stopped: ${track.kind}`);
      });
      this.systemStream = null;
    }
    
    if (this.mixedStream) {
      this.mixedStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🎛️ Mixed audio track stopped: ${track.kind}`);
      });
      this.mixedStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log('🎚️ Audio context closed');
      });
      this.audioContext = null;
    }
    
    this.gainNodes.clear();
    this.analyserNodes.clear();
    
    console.log('✅ Complete audio capture cleanup finished');
  }
}
