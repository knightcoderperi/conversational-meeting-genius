
export class VideoNameExtractor {
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private extractedNames: Set<string> = new Set();
  private speakerDatabase: Map<string, { name: string; firstSeen: number; confidence: number }> = new Map();
  private isProcessing: boolean = false;
  private extractionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async initializeVideoAnalysis(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    
    console.log('🎥 Initializing video name extraction...');
    
    if (videoElement.readyState >= 2) {
      this.startNameExtraction();
    } else {
      videoElement.addEventListener('loadedmetadata', () => {
        this.startNameExtraction();
      });
    }
  }

  private startNameExtraction(): void {
    console.log('🔍 Starting video name extraction...');
    
    // Extract names every 3 seconds
    this.extractionInterval = setInterval(() => {
      if (!this.isProcessing && this.videoElement && !this.videoElement.paused) {
        this.extractNamesFromCurrentFrame();
      }
    }, 3000);
    
    // Also extract on video play/pause events
    if (this.videoElement) {
      this.videoElement.addEventListener('play', () => {
        this.extractNamesFromCurrentFrame();
      });
    }
  }

  private async extractNamesFromCurrentFrame(): Promise<void> {
    if (!this.videoElement || this.videoElement.paused) return;
    
    this.isProcessing = true;
    
    try {
      // Capture current frame
      this.canvas.width = this.videoElement.videoWidth || 640;
      this.canvas.height = this.videoElement.videoHeight || 480;
      this.ctx.drawImage(this.videoElement, 0, 0);
      
      // Convert to image data
      const imageData = this.canvas.toDataURL('image/png');
      
      // Extract text using simple OCR simulation
      const extractedText = await this.performSimpleOCR(imageData);
      
      // Parse names from text
      const names = this.parseNamesFromText(extractedText);
      
      // Update speaker database
      this.updateSpeakerDatabase(names);
      
    } catch (error) {
      console.error('❌ Name extraction failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async performSimpleOCR(imageData: string): Promise<string> {
    // Simulate OCR by looking for common meeting interface patterns
    // In a real implementation, you'd use Tesseract.js or similar
    
    // For demo purposes, let's simulate finding names
    const simulatedNames = [
      'John Smith', 'Jane Doe', 'Michael Johnson', 'Sarah Wilson',
      'David Brown', 'Lisa Davis', 'Robert Miller', 'Emily Garcia'
    ];
    
    // Randomly return some names to simulate OCR detection
    const foundNames = simulatedNames.slice(0, Math.floor(Math.random() * 3) + 1);
    return foundNames.join(' ');
  }

  private parseNamesFromText(text: string): string[] {
    const names: string[] = [];
    
    // Enhanced name patterns
    const namePatterns = [
      // Full names: "John Smith", "Mary Jane Watson"
      /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})*\s+[A-Z][a-z]{2,}\b/g,
      // Names with initials: "John A. Smith"
      /\b[A-Z][a-z]{2,}\s+[A-Z]\.\s+[A-Z][a-z]{2,}\b/g,
      // Single names in professional context: "John", "Mary"
      /\b[A-Z][a-z]{3,}\b/g
    ];
    
    namePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanName = match.trim();
          if (this.isValidName(cleanName)) {
            names.push(cleanName);
          }
        });
      }
    });
    
    return [...new Set(names)]; // Remove duplicates
  }

  private isValidName(text: string): boolean {
    // Filter out common non-names
    const blacklist = [
      'meeting', 'zoom', 'teams', 'google', 'chat', 'video', 'audio',
      'screen', 'share', 'record', 'mute', 'unmute', 'join', 'leave',
      'participants', 'settings', 'more', 'camera', 'microphone'
    ];
    
    const lowerText = text.toLowerCase();
    const containsBlacklisted = blacklist.some(word => lowerText.includes(word));
    
    // Basic validation
    const hasValidFormat = /^[A-Za-z\s\.''-]{2,50}$/.test(text);
    const hasValidLength = text.length >= 2 && text.length <= 50;
    const hasLetter = /[A-Za-z]/.test(text);
    
    return !containsBlacklisted && hasValidFormat && hasValidLength && hasLetter;
  }

  private updateSpeakerDatabase(names: string[]): void {
    names.forEach(name => {
      if (!this.extractedNames.has(name)) {
        this.extractedNames.add(name);
        
        const speakerId = `speaker_${this.extractedNames.size}`;
        this.speakerDatabase.set(speakerId, {
          name: name,
          firstSeen: Date.now(),
          confidence: 0.85
        });
        
        console.log(`📝 New speaker identified: ${name}`);
      }
    });
  }

  getSpeakerName(speakerId: string): string {
    const speaker = this.speakerDatabase.get(speakerId);
    return speaker ? speaker.name : `Speaker ${speakerId.split('_')[1] || '1'}`;
  }

  getAllSpeakers(): Array<{ id: string; name: string; firstSeen: number }> {
    return Array.from(this.speakerDatabase.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      firstSeen: data.firstSeen
    }));
  }

  cleanup(): void {
    if (this.extractionInterval) {
      clearInterval(this.extractionInterval);
      this.extractionInterval = null;
    }
    this.isProcessing = false;
    console.log('🧹 Video name extractor cleaned up');
  }
}
