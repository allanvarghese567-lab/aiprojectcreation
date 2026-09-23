-- Safe, idempotent migration: only creates what's missing.
-- Run this in the Supabase SQL Editor.

-- ── Extensions ───────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── ai_agents: add missing column ───────────────────────────────────────
alter table public.ai_agents
  add column if not exists parent_agent_id uuid references public.ai_agents(id) on delete set null,
  add column if not exists level int not null default 0;

create index if not exists ai_agents_parent_agent_id_idx on public.ai_agents (parent_agent_id);

-- ── Seed the three orchestrators ────────────────────────────────────────
insert into public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
select 'BrahmAI', 'brahmai', 'active', 'live', 'system', 0, 'You are BrahmAI, the top-level orchestrator.'
where not exists (select 1 from public.ai_agents where slug = 'brahmai');

insert into public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
select 'VishvAI', 'vishvai', 'active', 'live', 'system', 0, 'You are VishvAI, the top-level orchestrator.'
where not exists (select 1 from public.ai_agents where slug = 'vishvai');

insert into public.ai_agents (name, slug, status, hosting_status, created_by, level, system_prompt)
select 'KaalAI', 'kaalai', 'active', 'live', 'system', 0, 'You are KaalAI, the top-level orchestrator.'
where not exists (select 1 from public.ai_agents where slug = 'kaalai');

-- ── agent_messages: create if missing ───────────────────────────────────
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  agent_slug text not null,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_agent_slug_created_at_idx
  on public.agent_messages (agent_slug, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.ai_agents enable row level security;
alter table public.agent_hosting enable row level security;
alter table public.agent_access enable row level security;
alter table public.agent_dependencies enable row level security;
alter table public.agent_destruction_log enable row level security;
alter table public.agent_messages enable row level security;

drop policy if exists "anon read ai_agents" on public.ai_agents;
create policy "anon read ai_agents" on public.ai_agents for select using (true);

drop policy if exists "anon insert ai_agents" on public.ai_agents;
create policy "anon insert ai_agents" on public.ai_agents for insert with check (true);

drop policy if exists "anon update ai_agents" on public.ai_agents;
create policy "anon update ai_agents" on public.ai_agents for update using (true);

drop policy if exists "anon read agent_hosting" on public.agent_hosting;
create policy "anon read agent_hosting" on public.agent_hosting for select using (true);

drop policy if exists "anon read agent_access" on public.agent_access;
create policy "anon read agent_access" on public.agent_access for select using (true);

drop policy if exists "anon read agent_dependencies" on public.agent_dependencies;
create policy "anon read agent_dependencies" on public.agent_dependencies for select using (true);

drop policy if exists "anon read agent_destruction_log" on public.agent_destruction_log;
create policy "anon read agent_destruction_log" on public.agent_destruction_log for select using (true);

drop policy if exists "anon read agent_messages" on public.agent_messages;
create policy "anon read agent_messages" on public.agent_messages for select using (true);

drop policy if exists "anon insert agent_messages" on public.agent_messages;
create policy "anon insert agent_messages" on public.agent_messages for insert with check (true);

-- ── Verify ───────────────────────────────────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'agent_messages';
