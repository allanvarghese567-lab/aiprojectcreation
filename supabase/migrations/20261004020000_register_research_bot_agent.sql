-- =====================================================
-- Register Research Bot as an agent under BrahmAI
-- and link dependency for hierarchy / orchestration
-- =====================================================

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS primary_url text,
  ADD COLUMN IF NOT EXISTS temporary_url text,
  ADD COLUMN IF NOT EXISTS system_prompt text;

INSERT INTO public.ai_agents (
  name,
  slug,
  status,
  hosting_status,
  created_by,
  level,
  parent_agent_id,
  github_repo,
  primary_url,
  system_prompt
)
SELECT
  'Research Bot',
  'research-bot',
  'active',
  'live',
  'system',
  1,
  (SELECT id FROM public.ai_agents WHERE slug = 'brahmai' LIMIT 1),
  'allanvarghese567-lab/research-bot',
  'https://allanvarghese567-lab.github.io/research-bot/',
  'You are a research specialist. Answer with evidence, calibrated confidence, sources, and risks. Research only — never financial advice. When the user asks for market, ticker, or evidence-backed analysis, produce structured research.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'research-bot'
);

INSERT INTO public.agent_dependencies (
  agent_id,
  depends_on_id,
  dependency_type,
  notes,
  created_by
)
SELECT
  a.id,
  r.id,
  'service',
  'Delegates evidence-backed research questions to research-bot LangGraph worker',
  'system'
FROM public.ai_agents a
JOIN public.ai_agents r ON r.slug = 'research-bot'
WHERE a.slug = 'brahmai'
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_dependencies d
    WHERE d.agent_id = a.id AND d.depends_on_id = r.id
  );

INSERT INTO public.agent_dependencies (agent_id, depends_on_id, dependency_type, notes, created_by)
SELECT a.id, r.id, 'service', 'Can invoke research-bot for evidence', 'system'
FROM public.ai_agents a
JOIN public.ai_agents r ON r.slug = 'research-bot'
WHERE a.slug IN ('vishvai', 'kaalai')
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_dependencies d
    WHERE d.agent_id = a.id AND d.depends_on_id = r.id
  );
