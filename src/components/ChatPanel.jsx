import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

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

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconRetry() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
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
  const [copiedId, setCopiedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [composerFocused, setComposerFocused] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

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
    setEditingId(null)
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

  // Auto-grow composer
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [draft])

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
    setEditingId(null)
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

  async function submitContent(content, { clearDraft = true } = {}) {
    const text = (content || '').trim()
    if (!text || sending) return

    setSending(true)
    if (clearDraft) setDraft('')
    setThinking(true)
    setEditingId(null)

    let threadId
    try {
      threadId = await ensureThread()
    } catch (err) {
      console.error(err)
      if (clearDraft) setDraft(text)
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
      content: text,
      created_by: userName,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMessage])

    const currentThread = threads.find((t) => t.id === threadId)
    if (!currentThread || currentThread.title === 'New chat') {
      const newTitle = titleFromContent(text)
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
        content: text,
        created_by: userName,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to send message', error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      if (clearDraft) setDraft(text)
      setSending(false)
      setThinking(false)
      return
    }

    if (inserted) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)))
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const { error: fnError } = await supabase.functions.invoke('agent-runtime', {
        body: {
          agent_slug: activeSlug,
          content: text,
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

  async function sendMessage(e) {
    e.preventDefault()
    await submitContent(draft)
  }

  function onComposerKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitContent(draft)
    }
  }

  async function copyMessage(m) {
    try {
      await navigator.clipboard.writeText(m.content || '')
      setCopiedId(m.id)
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500)
    } catch (err) {
      console.error('Copy failed', err)
      alert('Could not copy to clipboard')
    }
  }

  function startEdit(m) {
    setEditingId(m.id)
    setEditText(m.content || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function saveEdit(m) {
    const text = editText.trim()
    if (!text) return

    if (m.role === 'user' && m.id) {
      const { error } = await supabase
        .from('agent_messages')
        .update({ content: text })
        .eq('id', m.id)
      if (!error) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, content: text } : x))
        )
      }
    }

    setEditingId(null)
    setEditText('')
    await submitContent(text, { clearDraft: false })
  }

  async function retryMessage(m) {
    let content = m.content
    if (m.role === 'agent') {
      const idx = messages.findIndex((x) => x.id === m.id)
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          content = messages[i].content
          break
        }
      }
    }
    await submitContent(content, { clearDraft: false })
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
    <div className={`chat-panel ${composerFocused ? 'composer-focused' : ''}`}>
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
                  setEditingId(null)
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
              Click <em>+ New chat</em> to start with <strong>{active?.name}</strong>.
            </div>
          ) : messages.length === 0 && !thinking ? (
            <div className="empty">
              No messages in this chat yet.
              <br />
              Type below to message <strong>{active?.name}</strong>.
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

                  {editingId === m.id ? (
                    <div className="chat-edit-box">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="chat-edit-actions">
                        <button
                          type="button"
                          className="chat-action-btn primary"
                          onClick={() => saveEdit(m)}
                          disabled={sending}
                        >
                          Save & send
                        </button>
                        <button type="button" className="chat-action-btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-msg-content">{m.content}</div>
                  )}

                  {editingId !== m.id && (
                    <div className="chat-msg-actions">
                      <button
                        type="button"
                        className="chat-msg-action"
                        title="Copy"
                        onClick={() => copyMessage(m)}
                      >
                        <IconCopy />
                        <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {m.role === 'user' && (
                        <button
                          type="button"
                          className="chat-msg-action"
                          title="Edit"
                          onClick={() => startEdit(m)}
                          disabled={sending}
                        >
                          <IconEdit />
                          <span>Edit</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="chat-msg-action"
                        title="Retry"
                        onClick={() => retryMessage(m)}
                        disabled={sending}
                      >
                        <IconRetry />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}
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

        {/* Grok-style composer: all controls inside one bar */}
        <form className="chat-input-bar" onSubmit={sendMessage}>
          <div className="chat-input-inner">
            <div className="chat-composer-top">
              <button
                type="button"
                className="chat-icon-btn"
                title="New chat"
                onClick={createNewThread}
              >
                +
              </button>
              <textarea
                ref={inputRef}
                className="chat-composer-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder={`Message ${active?.name}…`}
                disabled={sending}
                rows={1}
                enterKeyHint="send"
              />
            </div>
            <div className="chat-composer-bottom">
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
