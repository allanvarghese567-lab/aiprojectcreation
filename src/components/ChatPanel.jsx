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
  const [thinking, setThinking] = useState(false) // ← new
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
      .channel(`messages-${activeSlug}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `agent_slug=eq.${activeSlug}`,
        },
        (payload) => {
          // When a real agent reply arrives, stop thinking
          if (payload.new.role === 'agent') {
            setThinking(false)
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeSlug])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  async function sendMessage(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setDraft('')
    setThinking(true) // ← start thinking indicator

    // Optimistic user message
    const tempId = crypto.randomUUID()
    const tempMessage = {
      id: tempId,
      agent_slug: activeSlug,
      role: 'user',
      content,
      created_by: userName,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMessage])

    // Save user message
    const { data: inserted, error } = await supabase
      .from('agent_messages')
      .insert({
        agent_slug: activeSlug,
        role: 'user',
        content,
        created_by: userName,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to send message', error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(content)
      setSending(false)
      setThinking(false)
      return
    }

    if (inserted) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)))
    }

    // Call agent-runtime
    try {
      const { error: fnError } = await supabase.functions.invoke('agent-runtime', {
        body: {
          agent_slug: activeSlug,
          content: content,
        },
      })

      if (fnError) {
        console.error('Runtime error:', fnError)
        setThinking(false)
      }
    } catch (err) {
      console.error('Failed to call agent-runtime', err)
      setThinking(false)
    }

    setSending(false)
    // Note: setThinking(false) is also called when Realtime receives the agent reply
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
            <div className="loading">Loading messages...</div>
          ) : messages.length === 0 && !thinking ? (
            <div className="empty">
              No messages with <strong>{active.name}</strong> yet.
              <br />
              Type a message below to start the conversation.
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.role}`}>
                  <div className="chat-msg-meta">
                    <span>
                      {m.role === 'agent' ? active.name : m.created_by || 'you'}
                    </span>
                    <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="chat-msg-content">{m.content}</div>
                </div>
              ))}

              {/* Thinking indicator */}
              {thinking && (
                <div className="chat-msg agent thinking">
                  <div className="chat-msg-meta">
                    <span>{active.name}</span>
                  </div>
                  <div className="chat-msg-content thinking-text">
                    <span className="thinking-label">Thinking</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <form className="chat-input-bar" onSubmit={sendMessage}>
          <div className="chat-input-inner">
            <button type="button" className="chat-icon-btn" title="Add">
              +
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${active.name}...`}
              disabled={sending}
            />

            <div className="chat-input-actions">
              <span className="chat-model-label">Fast</span>
              <button
                type="submit"
                className="chat-send-btn"
                disabled={sending || !draft.trim()}
                title="Send"
              >
                ↑
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
