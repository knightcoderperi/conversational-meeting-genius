export class RealSpeakerIdentifier {
  private nameExtractor: import('./videoNameExtractor').VideoNameExtractor;
  private audioActivity: Map<string, { level: number; timestamp: number }> = new Map();
  private currentSpeaker: { id: string; name: string } | null = null;
  private speakerHistory: Array<{
    speakerId: string;
    speakerName: string;
    timestamp: number;
    audioLevel: number;
    duration: number;
  }> = [];
  private lastSpeakingTime: number = 0;
  private speakingThreshold: number = 0.1;

  constructor(nameExtractor: import('./videoNameExtractor').VideoNameExtractor) {
    this.nameExtractor = nameExtractor;
  }

  identifySpeaker(audioLevel: number, timestamp: number = Date.now()): string {
    const availableSpeakers = this.nameExtractor.getAllSpeakers();
    
    // If no speakers identified yet, use generic labels
    if (availableSpeakers.length === 0) {
      return this.handleGenericSpeaker(audioLevel, timestamp);
    }
    
    // Determine if someone is currently speaking
    const isSpeaking = audioLevel > this.speakingThreshold;
    
    if (isSpeaking) {
      return this.handleActiveSpeaker(availableSpeakers, audioLevel, timestamp);
    } else {
      return this.handleSilence(timestamp);
    }
  }

  private handleGenericSpeaker(audioLevel: number, timestamp: number): string {
    if (audioLevel > this.speakingThreshold) {
      // Create a generic speaker if none exist
      if (!this.currentSpeaker) {
        this.currentSpeaker = { id: 'speaker_1', name: 'Speaker 1' };
      }
      
      this.recordSpeakingActivity(this.currentSpeaker, audioLevel, timestamp);
      return this.currentSpeaker.name;
    }
    
    return this.currentSpeaker?.name || 'Unknown Speaker';
  }

  private handleActiveSpeaker(
    availableSpeakers: Array<{ id: string; name: string; firstSeen: number }>,
    audioLevel: number,
    timestamp: number
  ): string {
    // Advanced speaker switching logic
    const timeSinceLastSpeech = timestamp - this.lastSpeakingTime;
    
    // If it's been more than 3 seconds since last speech, likely a new speaker
    if (timeSinceLastSpeech > 3000 || !this.currentSpeaker) {
      this.currentSpeaker = this.selectNextSpeaker(availableSpeakers);
    }
    
    this.recordSpeakingActivity(this.currentSpeaker, audioLevel, timestamp);
    this.lastSpeakingTime = timestamp;
    
    return this.currentSpeaker.name;
  }

  private handleSilence(timestamp: number): string {
    // During silence, maintain current speaker
    return this.currentSpeaker?.name || 'Unknown Speaker';
  }

  private selectNextSpeaker(availableSpeakers: Array<{ id: string; name: string; firstSeen: number }>): { id: string; name: string } {
    if (availableSpeakers.length === 0) {
      return { id: 'speaker_1', name: 'Speaker 1' };
    }
    
    // Simple round-robin selection
    const recentSpeakers = this.speakerHistory.slice(-5);
    const lastSpeakerIds = recentSpeakers.map(s => s.speakerId);
    
    // Find a speaker who hasn't spoken recently
    const nextSpeaker = availableSpeakers.find(speaker => 
      !lastSpeakerIds.includes(speaker.id)
    ) || availableSpeakers[0];
    
    return { id: nextSpeaker.id, name: nextSpeaker.name };
  }

  private recordSpeakingActivity(
    speaker: { id: string; name: string },
    audioLevel: number,
    timestamp: number
  ): void {
    const lastEntry = this.speakerHistory[this.speakerHistory.length - 1];
    const timeDiff = timestamp - (lastEntry?.timestamp || 0);
    
    // Only record if it's a new speaker or significant time has passed
    if (!lastEntry || lastEntry.speakerId !== speaker.id || timeDiff > 1000) {
      this.speakerHistory.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        timestamp: timestamp,
        audioLevel: audioLevel,
        duration: timeDiff
      });
      
      // Keep history manageable
      if (this.speakerHistory.length > 100) {
        this.speakerHistory = this.speakerHistory.slice(-50);
      }
    }
  }

  getCurrentSpeaker(): { id: string; name: string } | null {
    return this.currentSpeaker;
  }

  getSpeakerStats(): Map<string, {
    totalSpeakingTime: number;
    segments: number;
    avgAudioLevel: number;
    lastSeen: number;
  }> {
    const stats = new Map();
    
    this.speakerHistory.forEach(entry => {
      if (!stats.has(entry.speakerName)) {
        stats.set(entry.speakerName, {
          totalSpeakingTime: 0,
          segments: 0,
          avgAudioLevel: 0,
          lastSeen: 0
        });
      }
      
      const speakerData = stats.get(entry.speakerName);
      speakerData.totalSpeakingTime += entry.duration;
      speakerData.segments++;
      speakerData.avgAudioLevel += entry.audioLevel;
      speakerData.lastSeen = Math.max(speakerData.lastSeen, entry.timestamp);
    });
    
    // Calculate averages
    stats.forEach((data) => {
      if (data.segments > 0) {
        data.avgAudioLevel = data.avgAudioLevel / data.segments;
      }
    });
    
    return stats;
  }

  setSpeakingThreshold(threshold: number): void {
    this.speakingThreshold = Math.max(0, Math.min(1, threshold));
    console.log(`🎚️ Speaking threshold set to ${this.speakingThreshold}`);
  }

  reset(): void {
    this.currentSpeaker = null;
    this.speakerHistory = [];
    this.audioActivity.clear();
    this.lastSpeakingTime = 0;
    console.log('🔄 Speaker identifier reset');
  }
}
