# Option A: Research Bot on the same Supabase project

This wires [research-bot](https://github.com/allanvarghese567-lab/research-bot) into the AI Agents Control Center so BrahmAI / VishvAI / KaalAI (and the Research Bot agent) can queue evidence-backed research jobs.

## Architecture

```
ChatPanel → agent-runtime (Edge Function)
                │
                ├─ normal chat → agent_messages
                │
                └─ research query
                       → research_requests (pending)
                       → GitHub dispatch (optional) / worker cron
                       → tickets
                       → agent_messages (formatted reply)
```

All tables live in **one** Supabase project.

## 1. Apply migrations

In Supabase **SQL Editor**, run in order:

1. `supabase/migrations/20261004010000_research_bot_schema.sql`
2. `supabase/migrations/20261004020000_register_research_bot_agent.sql`

Or:

```bash
supabase db push
```

Confirm:

- Tables: `research_requests`, `tickets`, `decision_log`
- View: `calibration_report`
- Agent row: `slug = 'research-bot'` under BrahmAI
- Dependencies linking BrahmAI / VishvAI / KaalAI → research-bot

## 2. Point research-bot worker at this project

In **research-bot** GitHub Actions secrets (and local `worker/.env`):

| Secret | Value |
|--------|--------|
| `SUPABASE_URL` | **This** aiprojectcreation project URL |
| `SUPABASE_SERVICE_KEY` | service_role key of the **same** project |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | as before |
| others | unchanged |

Worker code does not need changes — it already reads `research_requests` where `status = pending`.

Enable the **research-worker** workflow in research-bot (cron + `repository_dispatch`).

## 3. Deploy agent-runtime

```bash
# from aiprojectcreation repo
supabase functions deploy agent-runtime

supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=... \
  GITHUB_TOKEN=... \          # optional, for instant dispatch
  GITHUB_OWNER=allanvarghese567-lab \
  GITHUB_REPO=research-bot
```

`SUPABASE_URL` is usually injected automatically for Edge Functions.

## 4. Frontend: pass `user_id` when invoking

In `ChatPanel.jsx`, when calling the runtime, include the signed-in user id:

```js
const { data: { session } } = await supabase.auth.getSession()

await supabase.functions.invoke('agent-runtime', {
  body: {
    agent_slug: activeSlug,
    content,
    user_id: session?.user?.id,  // required for research_requests FK
  },
})
```

Optional: use `src/lib/research.js` for direct UI flows (create request + Realtime on `tickets`).

## 5. Test

1. Log in on the dashboard.
2. Open **Hierarchy** — Research Bot should appear under BrahmAI.
3. Chat with BrahmAI: *“Research the recent outlook on NVDA with sources.”*
4. You should see a “research queued / running” message, then a structured ticket reply (if the worker finishes within the Edge Function poll window) or a queued notice.
5. In Supabase Table Editor: `research_requests` → `running`/`done`, `tickets` row present.
6. Manually run worker if needed:

```bash
cd research-bot/worker
# .env points at same SUPABASE_URL
python worker.py
```

## 6. Auth notes

- `research_requests.user_id` references `auth.users`. Guests cannot create research rows.
- Worker uses **service_role** and bypasses RLS.
- Users only read their own requests/tickets via RLS policies in the migration.

## 7. Files added

| Path | Purpose |
|------|---------|
| `supabase/migrations/20261004010000_research_bot_schema.sql` | Research tables + RLS + realtime |
| `supabase/migrations/20261004020000_register_research_bot_agent.sql` | Agent + dependencies |
| `src/lib/research.js` | Browser helper: create / poll / format |
| `supabase/functions/agent-runtime/index.ts` | Edge Function with research path |
| `INTEGRATION_RESEARCH_BOT.md` | This guide |

## Troubleshooting

| Symptom | Check |
|---------|--------|
| “Sign in required” | Session missing; pass `user_id` |
| Request stuck `pending` | Worker secrets, Actions cron, or run `python worker.py` |
| No ticket, status `error` | `research_requests.error_message`; LLM keys on worker |
| Hierarchy missing Research Bot | Re-run register migration |
| Dispatch 404 | `GITHUB_TOKEN` scope `repo`; owner/repo names |
