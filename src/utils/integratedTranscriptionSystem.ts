
import { MultiSpeakerAudioCapture } from './multiSpeakerAudioCapture';
import { VideoNameExtractor } from './videoNameExtractor';
import { RealSpeakerIdentifier } from './realSpeakerIdentifier';

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
  private audioCapture: MultiSpeakerAudioCapture;
  private nameExtractor: VideoNameExtractor;
  private speakerIdentifier: RealSpeakerIdentifier;
  private transcriptionBuffer: TranscriptionEntry[] = [];
  private isActive: boolean = false;
  private recognition: SpeechRecognition | null = null;
  private onTranscriptionUpdate: ((entries: TranscriptionEntry[]) => void) | null = null;

  constructor(onTranscriptionUpdate?: (entries: TranscriptionEntry[]) => void) {
    this.audioCapture = new MultiSpeakerAudioCapture();
    this.nameExtractor = new VideoNameExtractor();
    this.speakerIdentifier = new RealSpeakerIdentifier(this.nameExtractor);
    this.onTranscriptionUpdate = onTranscriptionUpdate || null;
  }

  async initialize(videoElement?: HTMLVideoElement): Promise<void> {
    try {
      console.log('🚀 Initializing integrated transcription system...');
      
      // 1. Setup audio capture
      await this.audioCapture.setupCompleteAudioCapture();
      
      // 2. Initialize video name extraction if video element provided
      if (videoElement) {
        await this.nameExtractor.initializeVideoAnalysis(videoElement);
      }
      
      // 3. Setup speech recognition
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
    const audioLevel = this.audioCapture.getAudioLevel();
    
    // Identify current speaker
    const currentSpeaker = this.speakerIdentifier.identifySpeaker(audioLevel, currentTime);
    const speakerData = this.speakerIdentifier.getCurrentSpeaker();
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 0.8;
      
      if (transcript.trim()) {
        const entry: TranscriptionEntry = {
          id: `${currentTime}_${i}`,
          timestamp: currentTime,
          speaker: currentSpeaker,
          speakerId: speakerData?.id || 'unknown',
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
    return this.speakerIdentifier.getSpeakerStats();
  }

  adjustAudioLevels(micVolume: number, systemVolume: number): void {
    this.audioCapture.adjustGain('microphone', micVolume);
    this.audioCapture.adjustGain('system', systemVolume);
  }

  setSpeakingThreshold(threshold: number): void {
    this.speakerIdentifier.setSpeakingThreshold(threshold);
  }

  cleanup(): void {
    this.stopTranscription();
    this.audioCapture.cleanup();
    this.nameExtractor.cleanup();
    this.speakerIdentifier.reset();
    this.transcriptionBuffer = [];
    console.log('🧹 System cleaned up');
  }
}
