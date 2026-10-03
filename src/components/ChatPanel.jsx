import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

/**
 * Chat tabs = orchestrators only.
 * Research Bot is the shared AI engine behind all three (agent-runtime
 * routes research-style questions and can power general replies).
 */
const ORCHESTRATORS = [
  { slug: 'brahmai', name: 'BrahmAI', badgeClass: 'brahma' },
  { slug: 'vishvai', name: 'VishvAI', badgeClass: 'vishva' },
  { slug: 'kaalai', name: 'KaalAI', badgeClass: 'kaal' },
]

function titleFromContent(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  if (!t) return 'New chat'
  return t.length > 42 ? t.slice(0, 42) + '…' : t
}

function formatThreadTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ChatPanel({ userName = 'you' }) {
  const [activeSlug, setActiveSlug] = useState(ORCHESTRATORS[0].slug)
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)

  const loadThreads = useCallback(async (slug) => {
    setLoadingThreads(true)
    const { data, error } = await supabase
      .from('agent_chat_threads')
      .select('*')
      .eq('agent_slug', slug)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to load threads', error)
      setThreads([])
      setActiveThreadId(null)
    } else {
      const list = data || []
      setThreads(list)
      setActiveThreadId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev
        return list[0]?.id ?? null
      })
    }
    setLoadingThreads(false)
  }, [])

  useEffect(() => {
    setMessages([])
    setThinking(false)
    loadThreads(activeSlug)
  }, [activeSlug, loadThreads])

  useEffect(() => {
    let cancelled = false
    let channel = null

    async function loadMessages() {
      if (!activeThreadId) {
        setMessages([])
        setLoadingMessages(false)
        return
      }

      setLoadingMessages(true)
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: true })

      if (!cancelled) {
        if (error) console.error('Failed to load messages', error)
        setMessages(data || [])
        setLoadingMessages(false)
      }
    }

    loadMessages()

    if (activeThreadId) {
      channel = supabase
        .channel(`messages-thread-${activeThreadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_messages',
            filter: `thread_id=eq.${activeThreadId}`,
          },
          (payload) => {
            if (payload.new.role === 'agent') setThinking(false)
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          }
        )
        .subscribe()
    }

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [activeThreadId])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  async function createNewThread() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data, error } = await supabase
      .from('agent_chat_threads')
      .insert({
        agent_slug: activeSlug,
        title: 'New chat',
        user_id: session?.user?.id ?? null,
        created_by: userName,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create thread', error)
      alert('Could not create chat. Run the chat_threads migration if the table is missing.')
      return
    }

    setThreads((prev) => [data, ...prev])
    setActiveThreadId(data.id)
    setMessages([])
    setThinking(false)
    setDraft('')
  }

  async function ensureThread() {
    if (activeThreadId) return activeThreadId

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data, error } = await supabase
      .from('agent_chat_threads')
      .insert({
        agent_slug: activeSlug,
        title: 'New chat',
        user_id: session?.user?.id ?? null,
        created_by: userName,
      })
      .select()
      .single()

    if (error) throw error
    setThreads((prev) => [data, ...prev.filter((t) => t.id !== data.id)])
    setActiveThreadId(data.id)
    return data.id
  }

  async function sendMessage(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setDraft('')
    setThinking(true)

    let threadId
    try {
      threadId = await ensureThread()
    } catch (err) {
      console.error(err)
      setDraft(content)
      setSending(false)
      setThinking(false)
      alert('Could not open a chat thread.')
      return
    }

    const tempId = crypto.randomUUID()
    const tempMessage = {
      id: tempId,
      agent_slug: activeSlug,
      thread_id: threadId,
      role: 'user',
      content,
      created_by: userName,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMessage])

    const currentThread = threads.find((t) => t.id === threadId)
    if (!currentThread || currentThread.title === 'New chat') {
      const newTitle = titleFromContent(content)
      await supabase
        .from('agent_chat_threads')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', threadId)
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, title: newTitle, updated_at: new Date().toISOString() }
            : t
        )
      )
    } else {
      await supabase
        .from('agent_chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
      setThreads((prev) => {
        const updated = prev.map((t) =>
          t.id === threadId ? { ...t, updated_at: new Date().toISOString() } : t
        )
        return updated.sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        )
      })
    }

    const { data: inserted, error } = await supabase
      .from('agent_messages')
      .insert({
        agent_slug: activeSlug,
        thread_id: threadId,
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

    // Orchestrator chat → agent-runtime (Research Bot is the engine for research paths)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const { error: fnError } = await supabase.functions.invoke('agent-runtime', {
        body: {
          agent_slug: activeSlug,
          content,
          user_id: session?.user?.id ?? null,
          thread_id: threadId,
          engine: 'research-bot',
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
  }

  async function deleteThread(threadId, e) {
    e.stopPropagation()
    if (!confirm('Delete this chat and all its messages?')) return

    const { error } = await supabase
      .from('agent_chat_threads')
      .delete()
      .eq('id', threadId)

    if (error) {
      console.error('Failed to delete thread', error)
      return
    }

    setThreads((prev) => prev.filter((t) => t.id !== threadId))
    if (activeThreadId === threadId) {
      setActiveThreadId(null)
      setMessages([])
    }
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
        <p className="chat-engine-hint">Engine: Research Bot</p>
      </div>

      <div className="chat-thread-list">
        <button type="button" className="chat-new-btn" onClick={createNewThread}>
          + New chat
        </button>

        <div className="chat-thread-scroll">
          {loadingThreads ? (
            <div className="chat-thread-empty">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="chat-thread-empty">
              No chats yet.
              <br />
              Start a new one.
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chat-thread-item ${activeThreadId === t.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveThreadId(t.id)
                  setThinking(false)
                }}
              >
                <span className="chat-thread-title">{t.title || 'New chat'}</span>
                <span className="chat-thread-meta">
                  <span>{formatThreadTime(t.updated_at)}</span>
                  <span
                    className="chat-thread-delete"
                    role="button"
                    tabIndex={0}
                    title="Delete chat"
                    onClick={(e) => deleteThread(t.id, e)}
                    onKeyDown={(e) => e.key === 'Enter' && deleteThread(t.id, e)}
                  >
                    ×
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="chat-body">
        <div className="chat-messages" ref={scrollRef}>
          {loadingMessages ? (
            <div className="loading">Loading messages...</div>
          ) : !activeThreadId ? (
            <div className="empty">
              <strong>No chat selected</strong>
              <br />
              Click <em>+ New chat</em> to start a conversation with{' '}
              <strong>{active?.name}</strong>.
              <br />
              <span style={{ opacity: 0.75, fontSize: '0.9em' }}>
                Powered by Research Bot as the shared AI engine.
              </span>
            </div>
          ) : messages.length === 0 && !thinking ? (
            <div className="empty">
              No messages in this chat yet.
              <br />
              Type below to message <strong>{active?.name}</strong>.
              <br />
              <span style={{ opacity: 0.75, fontSize: '0.9em' }}>
                Research-style questions use the Research Bot engine
                (evidence, sources, calibrated confidence).
              </span>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.role}`}>
                  <div className="chat-msg-meta">
                    <span>
                      {m.role === 'agent' ? active?.name : m.created_by || 'you'}
                    </span>
                    <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="chat-msg-content">{m.content}</div>
                </div>
              ))}

              {thinking && (
                <div className="chat-msg agent thinking">
                  <div className="chat-msg-meta">
                    <span>{active?.name}</span>
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
            <button
              type="button"
              className="chat-icon-btn"
              title="New chat"
              onClick={createNewThread}
            >
              +
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${active?.name}…`}
              disabled={sending}
            />

            <div className="chat-input-actions">
              <span className="chat-model-label">Research Bot</span>
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
