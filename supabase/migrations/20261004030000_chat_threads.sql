-- =====================================================
-- Multi-thread chats: threads + thread_id on messages
-- =====================================================

CREATE TABLE IF NOT EXISTS public.agent_chat_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug  text NOT NULL,
  title       text NOT NULL DEFAULT 'New chat',
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_chat_threads_agent_slug_idx
  ON public.agent_chat_threads (agent_slug, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_chat_threads_user_id_idx
  ON public.agent_chat_threads (user_id);

-- Link messages to a thread (nullable for legacy rows)
ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.agent_chat_threads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agent_messages_thread_id_idx
  ON public.agent_messages (thread_id, created_at);

-- RLS
ALTER TABLE public.agent_chat_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read agent_chat_threads" ON public.agent_chat_threads;
CREATE POLICY "anon read agent_chat_threads"
  ON public.agent_chat_threads FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert agent_chat_threads" ON public.agent_chat_threads;
CREATE POLICY "anon insert agent_chat_threads"
  ON public.agent_chat_threads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon update agent_chat_threads" ON public.agent_chat_threads;
CREATE POLICY "anon update agent_chat_threads"
  ON public.agent_chat_threads FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon delete agent_chat_threads" ON public.agent_chat_threads;
CREATE POLICY "anon delete agent_chat_threads"
  ON public.agent_chat_threads FOR DELETE USING (true);

-- Realtime for new threads (optional)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_chat_threads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
