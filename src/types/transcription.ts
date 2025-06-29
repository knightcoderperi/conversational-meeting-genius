
export interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  startTime?: number; // Optional for compatibility
  isFinal: boolean;
  speakerName?: string; // Optional for backward compatibility
}
