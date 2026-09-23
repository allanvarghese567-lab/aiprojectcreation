-- =====================================================
-- Migration: Initialize Agent System (Fixed)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add missing columns
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ai_agents_parent_agent_id_idx 
  ON public.ai_agents (parent_agent_id);

-- Seed the three core orchestrators (FIXED hosting_status)
INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'BrahmAI', 'brahmai', 'active', 'not_hosted', 'system', 0, 'You are BrahmAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'brahmai');

INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'VishvAI', 'vishvai', 'active', 'not_hosted', 'system', 0, 'You are VishvAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'vishvai');

INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'KaalAI', 'kaalai', 'active', 'not_hosted', 'system', 0, 'You are KaalAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'kaalai');

-- Create agent_messages table
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug    text NOT NULL,
  role          text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content       text NOT NULL,
  created_by    text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_agent_slug_created_at_idx
  ON public.agent_messages (agent_slug, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_hosting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_destruction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "anon read ai_agents" ON public.ai_agents;
CREATE POLICY "anon read ai_agents" ON public.ai_agents FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert ai_agents" ON public.ai_agents;
CREATE POLICY "anon insert ai_agents" ON public.ai_agents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon update ai_agents" ON public.ai_agents;
CREATE POLICY "anon update ai_agents" ON public.ai_agents FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anon read agent_hosting" ON public.agent_hosting;
CREATE POLICY "anon read agent_hosting" ON public.agent_hosting FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read agent_access" ON public.agent_access;
CREATE POLICY "anon read agent_access" ON public.agent_access FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read agent_dependencies" ON public.agent_dependencies;
CREATE POLICY "anon read agent_dependencies" ON public.agent_dependencies FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read agent_destruction_log" ON public.agent_destruction_log;
CREATE POLICY "anon read agent_destruction_log" ON public.agent_destruction_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read agent_messages" ON public.agent_messages;
CREATE POLICY "anon read agent_messages" ON public.agent_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon insert agent_messages" ON public.agent_messages;
CREATE POLICY "anon insert agent_messages" ON public.agent_messages FOR INSERT WITH CHECK (true);
