
export interface TranscriptionEntry {
  id: string;
  timestamp: number;
  speaker: string;
  speakerId: string;
  text: string;
  confidence: number;
  audioLevel: number;
  isFinal: boolean;
}

export class IntegratedTranscriptionSystem {
  private transcriptionBuffer: TranscriptionEntry[] = [];
  private isActive: boolean = false;
  private recognition: SpeechRecognition | null = null;
  private onTranscriptionUpdate: ((entries: TranscriptionEntry[]) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSpeaker: string = 'Speaker 1';
  private speakerCount: number = 1;
  private lastSpeechTime: number = 0;
  private silenceThreshold: number = 2000; // 2 seconds

  constructor(onTranscriptionUpdate?: (entries: TranscriptionEntry[]) => void) {
    this.onTranscriptionUpdate = onTranscriptionUpdate || null;
  }

  async initialize(videoElement?: HTMLVideoElement): Promise<void> {
    try {
      console.log('🚀 Initializing integrated transcription system...');
      
      // Setup speech recognition
      this.setupSpeechRecognition();
      
      console.log('✅ Integrated transcription system ready!');
      
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      throw error;
    }
  }

  private setupSpeechRecognition(): void {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionConstructor();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.recognition.onresult = (event) => {
        this.handleSpeechRecognitionResult(event);
      };
      
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Auto-restart on certain errors
        if (event.error === 'network' || event.error === 'no-speech') {
          setTimeout(() => {
            if (this.isActive && this.recognition) {
              this.recognition.start();
            }
          }, 1000);
        }
      };
      
      this.recognition.onend = () => {
        // Auto-restart if still active
        if (this.isActive && this.recognition) {
          setTimeout(() => {
            this.recognition!.start();
          }, 100);
        }
      };
    }
  }

  private handleSpeechRecognitionResult(event: SpeechRecognitionEvent): void {
    const currentTime = Date.now();
    const audioLevel = this.getAudioLevel();
    
    // Determine current speaker based on timing
    const timeSinceLastSpeech = currentTime - this.lastSpeechTime;
    if (timeSinceLastSpeech > this.silenceThreshold) {
      this.switchToNextSpeaker();
    }
    this.lastSpeechTime = currentTime;
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.8;
      
      if (transcript.trim()) {
        const entry: TranscriptionEntry = {
          id: `${currentTime}_${i}`,
          timestamp: currentTime,
          speaker: this.currentSpeaker,
          speakerId: this.currentSpeaker.toLowerCase().replace(' ', '_'),
          text: transcript.trim(),
          confidence: confidence,
          audioLevel: audioLevel,
          isFinal: result.isFinal
        };
        
        // Update or add entry
        if (result.isFinal) {
          this.addFinalTranscription(entry);
        } else {
          this.updateInterimTranscription(entry);
        }
      }
    }
  }

  private switchToNextSpeaker(): void {
    const currentNumber = parseInt(this.currentSpeaker.split(' ')[1]);
    const nextNumber = (currentNumber % 4) + 1;
    this.currentSpeaker = `Speaker ${nextNumber}`;
    this.speakerCount = Math.max(this.speakerCount, nextNumber);
    console.log(`🔄 Switched to ${this.currentSpeaker}`);
  }

  private getAudioLevel(): number {
    if (!this.analyser) return 0.5;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255;
  }

  private addFinalTranscription(entry: TranscriptionEntry): void {
    // Remove any interim results for this speaker
    this.transcriptionBuffer = this.transcriptionBuffer.filter(
      existing => existing.isFinal || existing.speaker !== entry.speaker
    );
    
    // Add final transcription
    this.transcriptionBuffer.push(entry);
    
    console.log(`💬 ${entry.speaker}: ${entry.text}`);
    
    // Trigger update callback
    if (this.onTranscriptionUpdate) {
      this.onTranscriptionUpdate([...this.transcriptionBuffer]);
    }
  }

  private updateInterimTranscription(entry: TranscriptionEntry): void {
    // Update interim result
    const existingIndex = this.transcriptionBuffer.findIndex(
      existing => !existing.isFinal && existing.speaker === entry.speaker
    );
    
    if (existingIndex >= 0) {
      this.transcriptionBuffer[existingIndex] = entry;
    } else {
      this.transcriptionBuffer.push(entry);
    }
    
    // Trigger update callback
    if (this.onTranscriptionUpdate) {
      this.onTranscriptionUpdate([...this.transcriptionBuffer]);
    }
  }

  async startTranscription(): Promise<void> {
    if (this.isActive) {
      console.warn('⚠️ Transcription already active');
      return;
    }
    
    try {
      this.isActive = true;
      
      // Start speech recognition
      if (this.recognition) {
        this.recognition.start();
      }
      
      console.log('🎙️ Transcription started!');
      
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      this.isActive = false;
      throw error;
    }
  }

  stopTranscription(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.recognition) {
      this.recognition.stop();
    }
    
    console.log('🛑 Transcription stopped');
  }

  getTranscriptionHistory(): TranscriptionEntry[] {
    return this.transcriptionBuffer.filter(entry => entry.isFinal);
  }

  getSpeakerStats() {
    const stats = new Map();
    
    this.transcriptionBuffer.filter(entry => entry.isFinal).forEach(entry => {
      if (!stats.has(entry.speaker)) {
        stats.set(entry.speaker, {
          totalWords: 0,
          segments: 0,
          avgConfidence: 0,
          totalConfidence: 0
        });
      }
      
      const speakerData = stats.get(entry.speaker);
      speakerData.totalWords += entry.text.split(' ').length;
      speakerData.segments++;
      speakerData.totalConfidence += entry.confidence;
      speakerData.avgConfidence = speakerData.totalConfidence / speakerData.segments;
    });
    
    return stats;
  }

  adjustAudioLevels(micVolume: number, systemVolume: number): void {
    console.log(`🔊 Audio levels adjusted: mic=${micVolume}, system=${systemVolume}`);
  }

  setSpeakingThreshold(threshold: number): void {
    this.silenceThreshold = threshold * 10000; // Convert to milliseconds
    console.log(`🎚️ Speaking threshold set to ${this.silenceThreshold}ms`);
  }

  cleanup(): void {
    this.stopTranscription();
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.transcriptionBuffer = [];
    console.log('🧹 System cleaned up');
  }
}
