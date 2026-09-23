-- Consolidated schema for the AI Agents platform (public schema)
-- Merged from: base table definitions + hierarchy/chat/RLS migration
-- NOTE: This is a manual merge of two source files, not a live pg_dump.
-- Verify against the actual Supabase project (e.g. `supabase db dump`)
-- before treating this as the source of truth.

-- ── Extensions ───────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Core tables ──────────────────────────────────────────────────────────

CREATE TABLE public.ai_agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  system_prompt text NOT NULL,
  credentials jsonb DEFAULT '{}'::jsonb,
  github_repo text,
  github_branch text DEFAULT 'main'::text,
  github_repo_id bigint,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'ready_for_hosting'::text, 'active'::text, 'paused'::text, 'archived'::text, 'destroyed'::text])),
  hosting_status text NOT NULL DEFAULT 'not_hosted'::text CHECK (hosting_status = ANY (ARRAY['not_hosted'::text, 'temporary'::text, 'permanent'::text, 'failed'::text])),
  primary_frontend_url text,
  primary_backend_url text,
  primary_ai_tool_url text,
  value_score numeric DEFAULT 0,
  dependency_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'BrahmAI'::text,
  updated_by text,
  deleted_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  parent_agent_id uuid,
  level int NOT NULL DEFAULT 0,
  layer integer NOT NULL DEFAULT 1,
  purpose text,
  agent_type text DEFAULT 'specialized'::text CHECK (agent_type = ANY (ARRAY['core'::text, 'specialized'::text, 'worker'::text, 'tool'::text])),
  CONSTRAINT ai_agents_pkey PRIMARY KEY (id),
  CONSTRAINT ai_agents_parent_agent_id_fkey FOREIGN KEY (parent_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ai_agents_parent_agent_id_idx ON public.ai_agents (parent_agent_id);

CREATE TABLE public.agent_access (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  principal text NOT NULL,
  permission text NOT NULL DEFAULT 'read'::text CHECK (permission = ANY (ARRAY['read'::text, 'write'::text, 'admin'::text, 'execute'::text])),
  expires_at timestamp with time zone,
  notes text,
  created_by text NOT NULL DEFAULT 'VishvAI'::text,
  updated_by text,
  deleted_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT agent_access_pkey PRIMARY KEY (id),
  CONSTRAINT agent_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id)
);

CREATE TABLE public.agent_hosting (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  service_type text NOT NULL CHECK (service_type = ANY (ARRAY['frontend'::text, 'backend'::text, 'ai_tool'::text, 'database'::text, 'other'::text])),
  provider text,
  temporary_url text,
  deployment_id text,
  custom_domain text,
  is_permanent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'building'::text, 'live'::text, 'failed'::text, 'paused'::text, 'destroyed'::text])),
  last_checked_at timestamp with time zone,
  health_status text DEFAULT 'unknown'::text CHECK (health_status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'down'::text, 'unknown'::text])),
  health_details jsonb DEFAULT '{}'::jsonb,
  build_logs_url text,
  environment_vars jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_by text NOT NULL DEFAULT 'VishvAI'::text,
  updated_by text,
  deleted_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT agent_hosting_pkey PRIMARY KEY (id),
  CONSTRAINT agent_hosting_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id)
);

CREATE TABLE public.agent_dependencies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  depends_on_id uuid,
  dependency_type text NOT NULL DEFAULT 'hard'::text CHECK (dependency_type = ANY (ARRAY['hard'::text, 'soft'::text, 'shared_secrets'::text, 'shared_infra'::text])),
  notes text,
  created_by text NOT NULL DEFAULT 'BrahmAI'::text,
  updated_by text,
  deleted_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT agent_dependencies_pkey PRIMARY KEY (id),
  CONSTRAINT agent_dependencies_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id),
  CONSTRAINT agent_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES public.ai_agents(id)
);

CREATE TABLE public.agent_destruction_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid,
  agent_name text,
  agent_slug text,
  github_repo text,
  github_branch text,
  reason text NOT NULL,
  dependency_check jsonb,
  value_assessment text,
  override_used boolean DEFAULT false,
  created_by text NOT NULL DEFAULT 'KaalAI'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_destruction_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agent_conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  session_id text,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT agent_conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id)
);

CREATE TABLE public.hosting_providers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  best_for text[],
  free_tier_summary text,
  sleeps_on_idle boolean DEFAULT false,
  api_base_url text,
  api_docs_url text,
  auth_type text,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 100,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hosting_providers_pkey PRIMARY KEY (id)
);

-- ── Chat / messages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'agent')),
  content text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_agent_slug_created_at_idx
  ON public.agent_messages (agent_slug, created_at);

-- ── Seed data: the three orchestrators ──────────────────────────────────

INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'BrahmAI', 'brahmai', 'active', 'live', 'system', 0, 'You are BrahmAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'brahmai');

INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'VishvAI', 'vishvai', 'active', 'live', 'system', 0, 'You are VishvAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'vishvai');

INSERT INTO public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
SELECT 'KaalAI', 'kaalai', 'active', 'live', 'system', 0, 'You are KaalAI, the top-level orchestrator.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE slug = 'kaalai');

-- ── Row Level Security ───────────────────────────────────────────────────
-- The app connects with the anon key, so every table it touches needs
-- explicit policies. As written below, anyone who can load the page can
-- read everything and write chat/agent rows — fine for an internal/demo
-- dashboard, NOT for anything holding real secrets or user data.

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_hosting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_destruction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

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
