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
  private speakerSwitchCooldown: number = 1000; // 1 second cooldown between speaker switches

  constructor(nameExtractor: import('./videoNameExtractor').VideoNameExtractor) {
    this.nameExtractor = nameExtractor;
  }

  identifySpeaker(audioLevel: number, timestamp: number = Date.now()): string {
    const availableSpeakers = this.nameExtractor.getAllSpeakers();
    
    // If no speakers identified yet from video, use audio-based detection
    if (availableSpeakers.length === 0) {
      return this.handleGenericSpeaker(audioLevel, timestamp);
    }
    
    // Check if someone is currently speaking
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
    // Get currently highlighted speaker from video
    const highlightedSpeaker = this.nameExtractor.getCurrentHighlightedSpeaker();
    
    // If we have a highlighted speaker from video, use that
    if (highlightedSpeaker && highlightedSpeaker.name) {
      const videoSpeaker = availableSpeakers.find(s => s.name === highlightedSpeaker.name);
      if (videoSpeaker) {
        this.currentSpeaker = { id: videoSpeaker.id, name: videoSpeaker.name };
        this.recordSpeakingActivity(this.currentSpeaker, audioLevel, timestamp);
        this.lastSpeakingTime = timestamp;
        return this.currentSpeaker.name;
      }
    }
    
    // Fallback to timing-based speaker detection
    const timeSinceLastSpeech = timestamp - this.lastSpeakingTime;
    
    // If it's been more than cooldown period since last speech, potentially switch speaker
    if (timeSinceLastSpeech > this.speakerSwitchCooldown || !this.currentSpeaker) {
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
    
    // Prioritize speakers based on recent video activity
    const recentSpeakers = this.speakerHistory.slice(-10);
    const recentSpeakerIds = recentSpeakers.map(s => s.speakerId);
    
    // Find a speaker who hasn't spoken recently, or the first available
    const nextSpeaker = availableSpeakers.find(speaker => 
      !recentSpeakerIds.includes(speaker.id)
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
    if (!lastEntry || lastEntry.speakerId !== speaker.id || timeDiff > 2000) {
      this.speakerHistory.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        timestamp: timestamp,
        audioLevel: audioLevel,
        duration: timeDiff
      });
      
      console.log(`🎤 Speaker activity: ${speaker.name} (level: ${audioLevel.toFixed(2)})`);
      
      // Keep history manageable
      if (this.speakerHistory.length > 50) {
        this.speakerHistory = this.speakerHistory.slice(-25);
      }
    }
  }

  getCurrentSpeaker(): { id: string; name: string } | null {
    return this.currentSpeaker;
  }

  getAllIdentifiedSpeakers(): Array<{ id: string; name: string }> {
    const speakers = new Set<string>();
    this.speakerHistory.forEach(entry => {
      speakers.add(JSON.stringify({ id: entry.speakerId, name: entry.speakerName }));
    });
    
    return Array.from(speakers).map(s => JSON.parse(s));
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

  setSpeakerSwitchCooldown(cooldown: number): void {
    this.speakerSwitchCooldown = Math.max(500, cooldown); // Minimum 500ms
    console.log(`⏱️ Speaker switch cooldown set to ${this.speakerSwitchCooldown}ms`);
  }

  forceSpeakerSwitch(availableSpeakers: Array<{ id: string; name: string; firstSeen: number }>): string {
    this.currentSpeaker = this.selectNextSpeaker(availableSpeakers);
    console.log(`🔄 Manually switched to ${this.currentSpeaker.name}`);
    return this.currentSpeaker.name;
  }

  reset(): void {
    this.currentSpeaker = null;
    this.speakerHistory = [];
    this.audioActivity.clear();
    this.lastSpeakingTime = 0;
    console.log('🔄 Speaker identifier reset');
  }
}
