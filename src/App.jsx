import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import ChatPanel from './components/ChatPanel'
import Hierarchy from './components/Hierarchy'
import AuthModal from './components/AuthModal'
import VendorKeys from './components/VendorKeys'

function StatusBadge({ status }) {
  return <span className={`status ${status}`}>{status}</span>
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default function App() {
  const [tab, setTab] = useState('chat')
  const [agents, setAgents] = useState([])
  const [hosting, setHosting] = useState([])
  const [access, setAccess] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [destruction, setDestruction] = useState([])
  const [connection, setConnection] = useState('Connecting...')
  const [loading, setLoading] = useState(true)

  // Auth
  const [session, setSession] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [isGuest, setIsGuest] = useState(false)

  // Hosting modal
  const [hostingProviders, setHostingProviders] = useState([])
  const [showHostModal, setShowHostModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [hostingLoading, setHostingLoading] = useState(false)

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setIsGuest(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load hosting providers
  useEffect(() => {
    async function loadProviders() {
      const { data } = await supabase
        .from('hosting_providers')
        .select('*')
        .eq('is_active', true)
        .order('priority')
      setHostingProviders(data || [])
    }
    loadProviders()
  }, [])

  const load = useCallback(async () => {
    try {
      const { error } = await supabase.from('ai_agents').select('id').limit(1)
      if (error) throw error
      setConnection('Connected to Supabase')
    } catch {
      setConnection('Connection failed – check URL & Key')
    }

    const [a, h, ac, d, dest] = await Promise.all([
      supabase
        .from('ai_agents')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_hosting')
        .select('*, ai_agents(name, slug)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_access')
        .select('*, ai_agents(name, slug)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_dependencies')
        .select(`
          *,
          agent:ai_agents!agent_id(name, slug),
          depends_on:ai_agents!depends_on_id(name, slug)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_destruction_log')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    setAgents(a.data || [])
    setHosting(h.data || [])
    setAccess(ac.data || [])
    setDependencies(d.data || [])
    setDestruction(dest.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'hierarchy', label: 'Hierarchy' },
    { id: 'agents', label: 'AI Agents' },
    { id: 'hosting', label: 'Hosting' },
    { id: 'access', label: 'Access Control' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'destruction', label: 'Destruction Log' },
    { id: 'keys', label: 'API Keys' },          // ← new tab
  ]

  const userLabel = session
    ? session.user.email
    : isGuest
    ? 'Guest'
    : null

  function handleHostAgent(agent) {
    setSelectedAgent(agent)
    setSelectedProvider(hostingProviders[0]?.name || '')
    setShowHostModal(true)
  }

  async function confirmHosting() {
    if (!selectedAgent || !selectedProvider) return
    setHostingLoading(true)

    try {
      const { error } = await supabase.functions.invoke('vishvai-manage-hosting', {
        body: {
          agent_id: selectedAgent.id,
          agent_slug: selectedAgent.slug,
          provider: selectedProvider,
          action: 'deploy',
        },
      })

      if (error) throw error

      alert(`Hosting started for ${selectedAgent.name} on ${selectedProvider}`)
      setShowHostModal(false)
      load()
    } catch (err) {
      alert('Hosting failed: ' + err.message)
    } finally {
      setHostingLoading(false)
    }
  }

  function getHostedUrl(agent) {
    const record = hosting.find(
      (h) => h.agent_id === agent.id || h.ai_agents?.slug === agent.slug
    )
    return record?.temporary_url || agent.primary_url || agent.temporary_url || null
  }

  return (
    <>
      <header>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>
          AI Agents Control Center
          <span className="badge brahma">BrahmAI</span>
          <span className="badge vishva">VishvAI</span>
          <span className="badge kaal">KaalAI</span>
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              fontSize: '0.85rem',
              color: connection.includes('Connected') ? '#22c55e' : '#ef4444',
            }}
          >
            {connection}
          </div>

          {session ? (
            <button className="tab" onClick={() => supabase.auth.signOut()}>
              Logout ({session.user.email})
            </button>
          ) : (
            <button className="tab" onClick={() => setShowAuth(true)}>
              {isGuest ? 'Guest – Login' : 'Login'}
            </button>
          )}
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'chat' ? (
          <ChatPanel userName={userLabel || 'you'} />
        ) : tab === 'keys' ? (
          <div className="card">
            <VendorKeys />
          </div>
        ) : (
          <div className="card">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <>
                {tab === 'hierarchy' && (
                  <Hierarchy agents={agents} onChanged={load} />
                )}

                {/* AI AGENTS */}
                {tab === 'agents' &&
                  (agents.length === 0 ? (
                    <div className="empty">No agents found</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Slug</th>
                          <th>Status</th>
                          <th>Hosting</th>
                          <th>GitHub</th>
                          <th>Actions</th>
                          <th>Created By</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((a) => {
                          const hostedUrl = getHostedUrl(a)
                          return (
                            <tr key={a.id}>
                              <td><strong>{a.name}</strong></td>
                              <td className="mono">{a.slug}</td>
                              <td><StatusBadge status={a.status} /></td>
                              <td><StatusBadge status={a.hosting_status} /></td>
                              <td>
                                {a.github_repo ? (
                                  <div className="github-cell">
                                    <span className="mono truncate" title={a.github_repo}>
                                      {a.github_repo}
                                    </span>
                                    <a
                                      href={`https://github.com/${a.github_repo}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="icon-btn"
                                      title="Open GitHub repo"
                                    >
                                      ↗
                                    </a>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <div className="action-buttons">
                                  {a.hosting_status === 'not_hosted' ||
                                  a.hosting_status === 'failed' ? (
                                    <button
                                      className="small-btn"
                                      onClick={() => handleHostAgent(a)}
                                      title="Deploy to free hosting"
                                    >
                                      Host
                                    </button>
                                  ) : hostedUrl ? (
                                    <a
                                      href={hostedUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="small-btn success"
                                      title="Open hosted URL"
                                    >
                                      Open
                                    </a>
                                  ) : (
                                    <span className="muted">Hosting...</span>
                                  )}
                                </div>
                              </td>
                              <td>{a.created_by}</td>
                              <td>{formatDate(a.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ))}

                {/* HOSTING */}
                {tab === 'hosting' &&
                  (hosting.length === 0 ? (
                    <div className="empty">No hosting records</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Type</th>
                          <th>Provider</th>
                          <th>URL</th>
                          <th>Status</th>
                          <th>Health</th>
                          <th>Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hosting.map((h) => (
                          <tr key={h.id}>
                            <td>{h.ai_agents?.name || '—'}</td>
                            <td>{h.service_type}</td>
                            <td>{h.provider || '—'}</td>
                            <td className="mono truncate">
                              {h.temporary_url ? (
                                <a
                                  href={h.temporary_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: '#93c5fd' }}
                                >
                                  {h.temporary_url}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td><StatusBadge status={h.status} /></td>
                            <td>{h.health_status}</td>
                            <td>{h.created_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}

                {/* ACCESS */}
                {tab === 'access' &&
                  (access.length === 0 ? (
                    <div className="empty">No access records</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Principal</th>
                          <th>Permission</th>
                          <th>Expires</th>
                          <th>Granted By</th>
                          <th>Granted At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {access.map((a) => (
                          <tr key={a.id}>
                            <td>{a.ai_agents?.name || '—'}</td>
                            <td className="mono">{a.principal}</td>
                            <td>{a.permission}</td>
                            <td>{formatDate(a.expires_at)}</td>
                            <td>{a.created_by}</td>
                            <td>{formatDate(a.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}

                {/* DEPENDENCIES */}
                {tab === 'dependencies' &&
                  (dependencies.length === 0 ? (
                    <div className="empty">No dependencies</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Depends On</th>
                          <th>Type</th>
                          <th>Notes</th>
                          <th>Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.map((d) => (
                          <tr key={d.id}>
                            <td>{d.agent?.name || '—'}</td>
                            <td>{d.depends_on?.name || '—'}</td>
                            <td>{d.dependency_type}</td>
                            <td>{d.notes || '—'}</td>
                            <td>{d.created_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}

                {/* DESTRUCTION */}
                {tab === 'destruction' &&
                  (destruction.length === 0 ? (
                    <div className="empty">No destruction records</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Slug</th>
                          <th>GitHub</th>
                          <th>Reason</th>
                          <th>Override</th>
                          <th>Destroyed By</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {destruction.map((d) => (
                          <tr key={d.id}>
                            <td>{d.agent_name || '—'}</td>
                            <td className="mono">{d.agent_slug || '—'}</td>
                            <td className="mono">{d.github_repo || '—'}</td>
                            <td>{d.reason}</td>
                            <td>{d.override_used ? 'Yes' : 'No'}</td>
                            <td>{d.created_by}</td>
                            <td>{formatDate(d.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(type) => {
            if (type === 'guest') setIsGuest(true)
          }}
        />
      )}

      {/* Hosting Modal */}
      {showHostModal && (
        <div className="auth-overlay" onClick={() => setShowHostModal(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setShowHostModal(false)}>
              ×
            </button>
            <h2>Host Agent</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--muted)' }}>
              Deploy <strong>{selectedAgent?.name}</strong> to a free temporary host
            </p>

            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Select Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              style={{
                width: '100%',
                marginTop: '0.4rem',
                marginBottom: '1.2rem',
                background: '#0f1117',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.7rem',
                color: 'var(--text)',
              }}
            >
              {hostingProviders.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.display_name} — {p.free_tier_summary}
                </option>
              ))}
            </select>

            <button
              className="small-btn"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={confirmHosting}
              disabled={hostingLoading}
            >
              {hostingLoading ? 'Deploying...' : 'Deploy Now'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
