export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      live_chat_messages: {
        Row: {
          ai_response: string | null
          context_summary: string | null
          id: string
          meeting_id: string | null
          message: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          context_summary?: string | null
          id?: string
          meeting_id?: string | null
          message: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          ai_response?: string | null
          context_summary?: string | null
          id?: string
          meeting_id?: string | null
          message?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: Json | null
          created_at: string | null
          duration: number | null
          end_time: string | null
          id: string
          key_discussions: Json | null
          participants: Json | null
          platform: string
          recording_url: string | null
          speaker_analytics: Json | null
          start_time: string | null
          status: string | null
          summary: string | null
          title: string
          transcript: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          action_items?: Json | null
          created_at?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          key_discussions?: Json | null
          participants?: Json | null
          platform: string
          recording_url?: string | null
          speaker_analytics?: Json | null
          start_time?: string | null
          status?: string | null
          summary?: string | null
          title: string
          transcript?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          action_items?: Json | null
          created_at?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          key_discussions?: Json | null
          participants?: Json | null
          platform?: string
          recording_url?: string | null
          speaker_analytics?: Json | null
          start_time?: string | null
          status?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      speaker_analytics: {
        Row: {
          created_at: string | null
          id: string
          interruptions: number | null
          key_topics: Json | null
          meeting_id: string | null
          sentiment_score: number | null
          speaker_id: string
          speaker_name: string
          total_speaking_time: number | null
          word_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interruptions?: number | null
          key_topics?: Json | null
          meeting_id?: string | null
          sentiment_score?: number | null
          speaker_id: string
          speaker_name: string
          total_speaking_time?: number | null
          word_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interruptions?: number | null
          key_topics?: Json | null
          meeting_id?: string | null
          sentiment_score?: number | null
          speaker_id?: string
          speaker_name?: string
          total_speaking_time?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_analytics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      transcription_segments: {
        Row: {
          confidence: number | null
          created_at: string | null
          end_time: number
          id: string
          is_final: boolean | null
          language: string | null
          meeting_id: string | null
          speaker_id: string | null
          speaker_name: string | null
          start_time: number
          text: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          end_time: number
          id?: string
          is_final?: boolean | null
          language?: string | null
          meeting_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          start_time: number
          text: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          end_time?: number
          id?: string
          is_final?: boolean | null
          language?: string | null
          meeting_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          start_time?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_segments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          email: string | null
          full_name: string | null
          id: string
          subscription_tier: string | null
          total_duration: number | null
          total_meetings: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          subscription_tier?: string | null
          total_duration?: number | null
          total_meetings?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          subscription_tier?: string | null
          total_duration?: number | null
          total_meetings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
