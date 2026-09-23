import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const ORCHESTRATORS = [
  { slug: 'brahmai', name: 'BrahmAI', badgeClass: 'brahma' },
  { slug: 'vishvai', name: 'VishvAI', badgeClass: 'vishva' },
  { slug: 'kaalai', name: 'KaalAI', badgeClass: 'kaal' },
]

export default function ChatPanel({ userName = 'you' }) {
  const [activeSlug, setActiveSlug] = useState(ORCHESTRATORS[0].slug)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('agent_slug', activeSlug)
        .order('created_at', { ascending: true })

      if (!cancelled) {
        if (error) console.error('Failed to load messages', error)
        setMessages(data || [])
        setLoading(false)
      }
    }

    loadMessages()

    const channel = supabase
      .channel(`agent_messages:${activeSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `agent_slug=eq.${activeSlug}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeSlug])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setDraft('')
    const { error } = await supabase.from('agent_messages').insert({
      agent_slug: activeSlug,
      role: 'user',
      content,
      created_by: userName,
    })
    if (error) {
      console.error('Failed to send message', error)
      setDraft(content)
    }
    setSending(false)
  }

  const active = ORCHESTRATORS.find((o) => o.slug === activeSlug)

  return (
    <div className="chat-panel">
      <div className="chat-agent-list">
        {ORCHESTRATORS.map((o) => (
          <button
            key={o.slug}
            className={`chat-agent-btn ${activeSlug === o.slug ? 'active' : ''}`}
            onClick={() => setActiveSlug(o.slug)}
          >
            <span className={`badge ${o.badgeClass}`}>{o.name}</span>
          </button>
        ))}
      </div>

      <div className="chat-body">
        <div className="chat-messages" ref={scrollRef}>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="empty">
              No messages with {active.name} yet. This log writes straight to the{' '}
              <span className="mono">agent_messages</span> table — wire your agent runtime to
              read new <span className="mono">role = 'user'</span> rows for{' '}
              <span className="mono">agent_slug = '{active.slug}'</span> and insert its own
              replies with <span className="mono">role = 'agent'</span> to answer here.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role}`}>
                <div className="chat-msg-meta">
                  <span>{m.role === 'agent' ? active.name : m.created_by || 'you'}</span>
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="chat-msg-content">{m.content}</div>
              </div>
            ))
          )}
        </div>

        <form className="chat-input-row" onSubmit={sendMessage}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${active.name}...`}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
