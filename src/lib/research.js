/**
 * Research Bot client (Option A — same Supabase project)
 *
 * Flow:
 *  1. Insert research_requests (status=pending)
 *  2. Optionally notify worker (GitHub dispatch via Edge Function / API)
 *  3. Poll or subscribe to tickets until done / error
 */
import { supabase } from '../supabase'

const RESEARCH_HINT =
  /\b(research|evidence|sources?|market|stock|ticker|bullish|bearish|analyze|outlook|forecast)\b/i

export function looksLikeResearchQuery(text) {
  return RESEARCH_HINT.test(text || '')
}

/**
 * Create a pending research request for the current user.
 * @returns {{ id: string } | null}
 */
export async function createResearchRequest(question, { agentSlug, messageId } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Sign in required to run research')
  }

  const row = {
    user_id: user.id,
    question: question.trim(),
    status: 'pending',
  }
  if (agentSlug) row.agent_slug = agentSlug
  if (messageId) row.message_id = messageId

  const { data, error } = await supabase
    .from('research_requests')
    .insert(row)
    .select('id, status, created_at')
    .single()

  if (error) throw error
  return data
}

/**
 * Poll until a ticket exists or the request errors / times out.
 * Prefer Realtime (subscribeToTicket) for production UI.
 */
export async function waitForTicket(requestId, { timeoutMs = 180_000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data: tickets, error: tErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('request_id', requestId)
      .limit(1)

    if (tErr) throw tErr
    if (tickets?.length) return tickets[0]

    const { data: reqs, error: rErr } = await supabase
      .from('research_requests')
      .select('status, error_message')
      .eq('id', requestId)
      .limit(1)

    if (rErr) throw rErr
    const st = reqs?.[0]
    if (st?.status === 'error') {
      throw new Error(st.error_message || 'Research failed')
    }
    if (st?.status === 'done') {
      await sleep(1000)
      continue
    }

    await sleep(intervalMs)
  }

  return null
}

/**
 * Subscribe to tickets for a request (Realtime).
 * Returns an unsubscribe function.
 */
export function subscribeToTicket(requestId, onTicket) {
  const channel = supabase
    .channel(`ticket-${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tickets',
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        if (payload.new) onTicket(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Format a ticket into a chat-friendly markdown reply.
 */
export function formatTicketReply(ticket) {
  if (!ticket) return 'No research result.'

  const sources = ticket.sources || {}
  const keyPoints = sources.key_points || []
  const risks = sources.risks || []
  const urls = sources.urls || []

  const parts = [
    `**Research result** · ${ticket.symbol}`,
    `**Stance:** ${ticket.stance} (${ticket.confidence}% confidence)`,
    '',
    ticket.summary,
  ]

  if (keyPoints.length) {
    parts.push('', '**Key points:**', ...keyPoints.map((p) => `- ${p}`))
  }
  if (risks.length) {
    parts.push('', '**Risks:**', ...risks.map((r) => `- ${r}`))
  }
  if (urls.length) {
    parts.push('', '**Sources:**', ...urls.map((u) => `- ${u}`))
  }

  parts.push('', '_Research only — not financial advice._')
  return parts.join('\n')
}

/**
 * Full helper: create request → wait → formatted text.
 * Worker must be running (GitHub Actions cron or local worker.py).
 */
export async function runResearch(question, opts = {}) {
  const req = await createResearchRequest(question, opts)
  const ticket = await waitForTicket(req.id, {
    timeoutMs: opts.timeoutMs ?? 180_000,
  })
  if (!ticket) {
    return {
      requestId: req.id,
      pending: true,
      text: 'Research is still running in the background. The worker will post a ticket when ready.',
    }
  }
  return {
    requestId: req.id,
    pending: false,
    ticket,
    text: formatTicketReply(ticket),
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
