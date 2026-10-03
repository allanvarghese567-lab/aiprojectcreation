-- =====================================================
-- Register Research Bot as an agent under BrahmAI
-- =====================================================
-- hosting_status: must satisfy ai_agents_hosting_status_check (use not_hosted)
-- dependency_type: must satisfy agent_dependencies_dependency_type_check
--   ("service" is NOT allowed; try required / optional safely)

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS primary_url text,
  ADD COLUMN IF NOT EXISTS temporary_url text,
  ADD COLUMN IF NOT EXISTS system_prompt text;

-- 1) Register agent (idempotent)
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
  'not_hosted',
  'system',
  1,
  (SELECT id FROM public.ai_agents WHERE slug = 'brahmai' LIMIT 1),
  'allanvarghese567-lab/research-bot',
  'https://allanvarghese567-lab.github.io/research-bot/',
  'You are a research specialist. Answer with evidence, calibrated confidence, sources, and risks. Research only — never financial advice. When the user asks for market, ticker, or evidence-backed analysis, produce structured research.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'research-bot'
);

-- 2) Dependencies — try common allowed types; never fail the whole migration
DO $$
DECLARE
  brahma uuid;
  vishva uuid;
  kaal uuid;
  research uuid;
  dtype text;
  candidates text[] := ARRAY['required', 'optional', 'hard', 'soft', 'runtime', 'api', 'data', 'uses'];
BEGIN
  SELECT id INTO brahma FROM public.ai_agents WHERE slug = 'brahmai' LIMIT 1;
  SELECT id INTO vishva FROM public.ai_agents WHERE slug = 'vishvai' LIMIT 1;
  SELECT id INTO kaal FROM public.ai_agents WHERE slug = 'kaalai' LIMIT 1;
  SELECT id INTO research FROM public.ai_agents WHERE slug = 'research-bot' LIMIT 1;

  IF research IS NULL THEN
    RAISE NOTICE 'research-bot agent missing; skip dependencies';
    RETURN;
  END IF;

  FOREACH dtype IN ARRAY candidates
  LOOP
    BEGIN
      IF brahma IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.agent_dependencies
        WHERE agent_id = brahma AND depends_on_id = research
      ) THEN
        INSERT INTO public.agent_dependencies (agent_id, depends_on_id, dependency_type, notes, created_by)
        VALUES (brahma, research, dtype, 'Delegates research to research-bot LangGraph worker', 'system');
      END IF;

      IF vishva IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.agent_dependencies
        WHERE agent_id = vishva AND depends_on_id = research
      ) THEN
        INSERT INTO public.agent_dependencies (agent_id, depends_on_id, dependency_type, notes, created_by)
        VALUES (vishva, research, dtype, 'Can invoke research-bot for evidence', 'system');
      END IF;

      IF kaal IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.agent_dependencies
        WHERE agent_id = kaal AND depends_on_id = research
      ) THEN
        INSERT INTO public.agent_dependencies (agent_id, depends_on_id, dependency_type, notes, created_by)
        VALUES (kaal, research, dtype, 'Can invoke research-bot for evidence', 'system');
      END IF;

      RAISE NOTICE 'agent_dependencies inserted with dependency_type=%', dtype;
      RETURN; -- success with this type
    EXCEPTION
      WHEN check_violation THEN
        RAISE NOTICE 'dependency_type % rejected by check constraint, trying next', dtype;
      WHEN OTHERS THEN
        RAISE NOTICE 'dependency insert skipped: %', SQLERRM;
        RETURN;
    END;
  END LOOP;

  RAISE NOTICE 'No allowed dependency_type found; agent registered without dependency rows';
END $$;
