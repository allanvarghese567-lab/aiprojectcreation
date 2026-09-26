-- =====================================================
-- Multi-agent critique / debate system
-- =====================================================

CREATE TABLE IF NOT EXISTS public.agent_critiques (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  target_slug     text,
  action          text NOT NULL,               -- 'create', 'host', 'destroy', 'propose'
  proposed_by     text NOT NULL,               -- 'brahmai'
  reviewer        text NOT NULL,               -- 'vishvai' | 'kaalai'
  decision        text NOT NULL CHECK (decision IN ('approve', 'reject', 'improve')),
  critique        text NOT NULL,
  score           smallint CHECK (score BETWEEN 1 AND 10),
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_critiques_target_idx 
  ON public.agent_critiques (target_agent_id);

CREATE INDEX IF NOT EXISTS agent_critiques_reviewer_idx 
  ON public.agent_critiques (reviewer);

CREATE INDEX IF NOT EXISTS agent_critiques_created_at_idx 
  ON public.agent_critiques (created_at DESC);

ALTER TABLE public.agent_critiques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read agent_critiques" ON public.agent_critiques;
CREATE POLICY "anon read agent_critiques" 
  ON public.agent_critiques FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert agent_critiques" ON public.agent_critiques;
CREATE POLICY "anon insert agent_critiques" 
  ON public.agent_critiques FOR INSERT WITH CHECK (true);
