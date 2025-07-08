-- Fix RLS performance issues by optimizing auth function calls
-- Replace auth.uid() with (select auth.uid()) for better performance

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view own transcriptions" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can view own chats" ON public.live_chat_messages;
DROP POLICY IF EXISTS "Users can view own analytics" ON public.speaker_analytics;

-- Create optimized policies with (select auth.uid())
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR ALL USING ((select auth.uid()) = id);

CREATE POLICY "Users can view own meetings" ON public.meetings FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own transcriptions" ON public.transcription_segments FOR ALL USING (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = (select auth.uid()))
);

CREATE POLICY "Users can view own chats" ON public.live_chat_messages FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own analytics" ON public.speaker_analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.user_id = (select auth.uid()))
);