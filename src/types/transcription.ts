

export interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  startTime?: number; // Make optional for compatibility
  isFinal: boolean;
  speakerName?: string; // Optional for backward compatibility
}

