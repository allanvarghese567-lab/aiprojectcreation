-- Run this in the Supabase SQL editor.
-- Adds an org hierarchy to ai_agents and a chat log for Brahma/VishvAI/KaalAI,
-- and turns on RLS since the app now connects with the anon key.

-- ── Hierarchy ────────────────────────────────────────────────────────────
-- level 0 = the three orchestrators (Brahma, VishvAI, KaalAI)
-- level 1+ = agents spawned/managed by a parent agent
alter table ai_agents
  add column if not exists parent_agent_id uuid references ai_agents(id) on delete set null,
  add column if not exists level int not null default 0;

create index if not exists ai_agents_parent_agent_id_idx on ai_agents (parent_agent_id);

-- Seed the three orchestrators if they don't exist yet.
insert into ai_agents (name, slug, status, hosting_status, created_by, level)
select 'BrahmAI', 'brahmai', 'active', 'live', 'system', 0
where not exists (select 1 from ai_agents where slug = 'brahmai');

insert into ai_agents (name, slug, status, hosting_status, created_by, level)
select 'VishvAI', 'vishvai', 'active', 'live', 'system', 0
where not exists (select 1 from ai_agents where slug = 'vishvai');

insert into ai_agents (name, slug, status, hosting_status, created_by, level)
select 'KaalAI', 'kaalai', 'active', 'live', 'system', 0
where not exists (select 1 from ai_agents where slug = 'kaalai');

-- ── Chat ─────────────────────────────────────────────────────────────────
create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  agent_slug text not null,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_agent_slug_created_at_idx
  on agent_messages (agent_slug, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- The app now uses the anon key, so every table it touches needs explicit
-- policies. Adjust these to your actual auth model — as written, anyone who
-- can load the page can read everything and write chat messages, which is
-- fine for an internal/demo dashboard but NOT for anything with real secrets.

alter table ai_agents enable row level security;
alter table agent_hosting enable row level security;
alter table agent_access enable row level security;
alter table agent_dependencies enable row level security;
alter table agent_destruction_log enable row level security;
alter table agent_messages enable row level security;

drop policy if exists "anon read ai_agents" on ai_agents;
create policy "anon read ai_agents" on ai_agents for select using (true);

drop policy if exists "anon read agent_hosting" on agent_hosting;
create policy "anon read agent_hosting" on agent_hosting for select using (true);

drop policy if exists "anon read agent_access" on agent_access;
create policy "anon read agent_access" on agent_access for select using (true);

drop policy if exists "anon read agent_dependencies" on agent_dependencies;
create policy "anon read agent_dependencies" on agent_dependencies for select using (true);

drop policy if exists "anon read agent_destruction_log" on agent_destruction_log;
create policy "anon read agent_destruction_log" on agent_destruction_log for select using (true);

drop policy if exists "anon read agent_messages" on agent_messages;
create policy "anon read agent_messages" on agent_messages for select using (true);

drop policy if exists "anon insert agent_messages" on agent_messages;
create policy "anon insert agent_messages" on agent_messages for insert with check (true);

drop policy if exists "anon insert ai_agents" on ai_agents;
create policy "anon insert ai_agents" on ai_agents for insert with check (true);

drop policy if exists "anon update ai_agents" on ai_agents;
create policy "anon update ai_agents" on ai_agents for update using (true);
