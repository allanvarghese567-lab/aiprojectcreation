-- =====================================================
-- Migration: Add RAG (pgvector) + Feedback tables
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (RAG memory)
CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_slug    text,
  content       text NOT NULL,
  embedding     vector(768),
  source        text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_by    text DEFAULT 'system',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_agent_id_idx ON public.documents (agent_id);
CREATE INDEX IF NOT EXISTS documents_agent_slug_idx ON public.documents (agent_slug);

-- Vector index
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
  ON public.documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Feedback table
CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  agent_slug    text NOT NULL,
  rating        smallint CHECK (rating IN (-1, 1)),
  correction    text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_feedback_agent_slug_idx ON public.agent_feedback (agent_slug);
CREATE INDEX IF NOT EXISTS agent_feedback_message_id_idx ON public.agent_feedback (message_id);

-- Preference pairs (future DPO)
CREATE TABLE IF NOT EXISTS public.preference_pairs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug    text,
  prompt        text NOT NULL,
  chosen        text NOT NULL,
  rejected      text NOT NULL,
  source        text DEFAULT 'user_feedback',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read documents" ON public.documents;
CREATE POLICY "anon read documents" ON public.documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon insert documents" ON public.documents;
CREATE POLICY "anon insert documents" ON public.documents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon read agent_feedback" ON public.agent_feedback;
CREATE POLICY "anon read agent_feedback" ON public.agent_feedback FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon insert agent_feedback" ON public.agent_feedback;
CREATE POLICY "anon insert agent_feedback" ON public.agent_feedback FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon read preference_pairs" ON public.preference_pairs;
CREATE POLICY "anon read preference_pairs" ON public.preference_pairs FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon insert preference_pairs" ON public.preference_pairs;
CREATE POLICY "anon insert preference_pairs" ON public.preference_pairs FOR INSERT WITH CHECK (true);
