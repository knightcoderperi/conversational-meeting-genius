
export interface TranscriptionSegment {
  id: string;
  speaker: string;
  text: string;
  confidence: number;
  timestamp: string;
  startTime: number;
  isFinal: boolean;
  speakerName?: string; // Optional for backward compatibility
}
