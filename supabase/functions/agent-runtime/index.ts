/**
 * Supabase Edge Function: agent-runtime
 *
 * Option A integration — same Supabase project as research-bot tables.
 *
 * Deploy:
 *   supabase functions deploy agent-runtime --no-verify-jwt  # or with JWT as preferred
 *
 * Secrets (supabase secrets set ...):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   GROQ_API_KEY / GEMINI_API_KEY (for normal chat path)
 *   Optional: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO  (instant research dispatch)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER") || "allanvarghese567-lab";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") || "research-bot";

const RESEARCH_HINT =
  /\b(research|evidence|sources?|market|stock|ticker|bullish|bearish|analyze|outlook|forecast)\b/i;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const body = await req.json();
    const agentSlug: string = body.agent_slug || "brahmai";
    const content: string = (body.content || "").trim();
    const userId: string | undefined = body.user_id;

    if (!content) {
      return cors(json({ error: "content required" }, 400));
    }

    const needsResearch =
      agentSlug === "research-bot" || RESEARCH_HINT.test(content);

    if (needsResearch) {
      if (!userId) {
        await insertMessage(
          agentSlug,
          "agent",
          "Research needs a signed-in user. Please log in and try again."
        );
        return cors(json({ ok: true, mode: "research_auth_required" }));
      }

      await insertMessage(
        agentSlug,
        "agent",
        "Running evidence-backed research… This may take up to a few minutes while the worker processes sources."
      );

      const { data: reqRow, error: insErr } = await sb
        .from("research_requests")
        .insert({
          user_id: userId,
          question: content,
          status: "pending",
          agent_slug: agentSlug,
        })
        .select("id")
        .single();

      if (insErr) {
        await insertMessage(
          agentSlug,
          "agent",
          `Could not queue research: ${insErr.message}`
        );
        return cors(json({ error: insErr.message }, 500));
      }

      await triggerGithubDispatch(reqRow.id);

      const ticket = await pollTicket(reqRow.id, 45_000);

      if (ticket) {
        await insertMessage(agentSlug, "agent", formatTicket(ticket));
        return cors(json({ ok: true, mode: "research_done", request_id: reqRow.id }));
      }

      await insertMessage(
        agentSlug,
        "agent",
        `Research queued (id: \`${reqRow.id}\`). The worker is still running — check back shortly or open Research Bot for the full ticket.`
      );
      return cors(json({ ok: true, mode: "research_queued", request_id: reqRow.id }));
    }

    const reply =
      `(${agentSlug}) Received: "${content}". ` +
      `For evidence-backed market or topic research, ask a research-style question or chat with Research Bot.`;

    await insertMessage(agentSlug, "agent", reply);
    return cors(json({ ok: true, mode: "chat" }));
  } catch (e) {
    console.error(e);
    return cors(json({ error: String(e) }, 500));
  }
});

async function insertMessage(agentSlug: string, role: string, content: string) {
  await sb.from("agent_messages").insert({
    agent_slug: agentSlug,
    role,
    content,
    created_by: role === "agent" ? agentSlug : "user",
  });
}

async function pollTicket(requestId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await sb
      .from("tickets")
      .select("*")
      .eq("request_id", requestId)
      .limit(1);
    if (data?.length) return data[0];

    const { data: reqs } = await sb
      .from("research_requests")
      .select("status, error_message")
      .eq("id", requestId)
      .limit(1);
    if (reqs?.[0]?.status === "error") {
      throw new Error(reqs[0].error_message || "Research failed");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

async function triggerGithubDispatch(requestId: string) {
  if (!GITHUB_TOKEN) return false;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: "research_request",
          client_payload: { request_id: requestId },
        }),
      }
    );
    return r.status === 204 || r.status === 200;
  } catch {
    return false;
  }
}

function formatTicket(t: Record<string, unknown>): string {
  const sources = (t.sources || {}) as {
    key_points?: string[];
    risks?: string[];
    urls?: string[];
  };
  const parts = [
    `**Research result** · ${t.symbol}`,
    `**Stance:** ${t.stance} (${t.confidence}% confidence)`,
    "",
    String(t.summary || ""),
  ];
  if (sources.key_points?.length) {
    parts.push("", "**Key points:**", ...sources.key_points.map((p) => `- ${p}`));
  }
  if (sources.risks?.length) {
    parts.push("", "**Risks:**", ...sources.risks.map((r) => `- ${r}`));
  }
  if (sources.urls?.length) {
    parts.push("", "**Sources:**", ...sources.urls.map((u) => `- ${u}`));
  }
  parts.push("", "_Research only — not financial advice._");
  return parts.join("\n");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}
