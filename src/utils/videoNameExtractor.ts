
export interface DetectedSpeaker {
  id: string;
  name: string;
  firstSeen: number;
  lastSeen: number;
  confidence: number;
  isActive: boolean;
}

export class VideoNameExtractor {
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private detectedSpeakers: Map<string, DetectedSpeaker> = new Map();
  private isAnalyzing: boolean = false;
  private analysisInterval: number | null = null;
  private currentHighlightedSpeaker: DetectedSpeaker | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d')!;
  }

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    try {
      console.log('🎥 Initializing video name extractor...');
      this.videoElement = videoElement;
      
      // Wait for video to be ready
      if (videoElement.readyState < 2) {
        await new Promise((resolve) => {
          videoElement.addEventListener('loadeddata', resolve, { once: true });
        });
      }

      this.canvas.width = videoElement.videoWidth || 640;
      this.canvas.height = videoElement.videoHeight || 480;
      
      console.log(`📐 Video dimensions: ${this.canvas.width}x${this.canvas.height}`);
      
      // Start analysis
      this.startAnalysis();
      
      console.log('✅ Video name extractor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize video name extractor:', error);
      throw error;
    }
  }

  private startAnalysis(): void {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    
    // Analyze video frames every 2 seconds
    this.analysisInterval = window.setInterval(() => {
      this.analyzeCurrentFrame();
    }, 2000);
    
    console.log('🔍 Started video analysis');
  }

  private analyzeCurrentFrame(): void {
    if (!this.videoElement || this.videoElement.paused) return;
    
    try {
      // Draw current video frame to canvas
      this.context.drawImage(
        this.videoElement,
        0, 0,
        this.canvas.width,
        this.canvas.height
      );
      
      // Simulate speaker detection and name extraction
      // In a real implementation, this would use computer vision and OCR
      this.simulateSpeakerDetection();
      
    } catch (error) {
      console.error('Error analyzing video frame:', error);
    }
  }

  private simulateSpeakerDetection(): void {
    const currentTime = Date.now();
    
    // Simulate detecting speakers with names from video
    // This would typically use face detection + OCR for name badges
    const mockSpeakers = [
      { name: 'John Smith', confidence: 0.9 },
      { name: 'Sarah Johnson', confidence: 0.85 },
      { name: 'Mike Davis', confidence: 0.8 },
      { name: 'Lisa Wilson', confidence: 0.88 }
    ];
    
    // Randomly simulate speaker activity (in real app, this would be based on video analysis)
    const activeSpeaker = mockSpeakers[Math.floor(Math.random() * mockSpeakers.length)];
    const speakerId = activeSpeaker.name.toLowerCase().replace(/\s+/g, '_');
    
    // Update or add speaker
    if (this.detectedSpeakers.has(speakerId)) {
      const speaker = this.detectedSpeakers.get(speakerId)!;
      speaker.lastSeen = currentTime;
      speaker.confidence = Math.max(speaker.confidence, activeSpeaker.confidence);
      speaker.isActive = true;
      this.currentHighlightedSpeaker = speaker;
    } else {
      const newSpeaker: DetectedSpeaker = {
        id: speakerId,
        name: activeSpeaker.name,
        firstSeen: currentTime,
        lastSeen: currentTime,
        confidence: activeSpeaker.confidence,
        isActive: true
      };
      this.detectedSpeakers.set(speakerId, newSpeaker);
      this.currentHighlightedSpeaker = newSpeaker;
      
      console.log(`👤 New speaker detected: ${activeSpeaker.name}`);
    }
    
    // Mark other speakers as inactive
    this.detectedSpeakers.forEach((speaker, id) => {
      if (id !== speakerId) {
        speaker.isActive = false;
      }
    });
  }

  getCurrentHighlightedSpeaker(): DetectedSpeaker | null {
    return this.currentHighlightedSpeaker;
  }

  getAllSpeakers(): Array<{ id: string; name: string; firstSeen: number }> {
    return Array.from(this.detectedSpeakers.values()).map(speaker => ({
      id: speaker.id,
      name: speaker.name,
      firstSeen: speaker.firstSeen
    }));
  }

  getActiveSpeakers(): Array<DetectedSpeaker> {
    return Array.from(this.detectedSpeakers.values()).filter(speaker => speaker.isActive);
  }

  getSpeakerById(id: string): DetectedSpeaker | null {
    return this.detectedSpeakers.get(id) || null;
  }

  cleanup(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    this.isAnalyzing = false;
    this.detectedSpeakers.clear();
    this.currentHighlightedSpeaker = null;
    
    console.log('🧹 Video name extractor cleaned up');
  }
}
