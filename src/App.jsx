import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function StatusBadge({ status }) {
  return <span className={`status ${status}`}>{status}</span>
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default function App() {
  const [tab, setTab] = useState('agents')
  const [agents, setAgents] = useState([])
  const [hosting, setHosting] = useState([])
  const [access, setAccess] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [destruction, setDestruction] = useState([])
  const [connection, setConnection] = useState('Connecting...')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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
    }
    load()
  }, [])

  const tabs = [
    { id: 'agents', label: 'AI Agents' },
    { id: 'hosting', label: 'Hosting' },
    { id: 'access', label: 'Access Control' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'destruction', label: 'Destruction Log' },
  ]

  return (
    <>
      <header>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>
          AI Agents Control Center
          <span className="badge brahma">BrahmAI</span>
          <span className="badge vishva">VishvAI</span>
          <span className="badge kaal">KaalAI</span>
        </h1>
        <div
          style={{
            fontSize: '0.85rem',
            color: connection.includes('Connected') ? '#22c55e' : '#ef4444',
          }}
        >
          {connection}
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

        <div className="card">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
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
                        <th>Created By</th>
                        <th>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.name}</strong>
                          </td>
                          <td className="mono">{a.slug}</td>
                          <td>
                            <StatusBadge status={a.status} />
                          </td>
                          <td>
                            <StatusBadge status={a.hosting_status} />
                          </td>
                          <td className="mono truncate">{a.github_repo || '—'}</td>
                          <td>{a.created_by}</td>
                          <td>{formatDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}

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
                          <td>
                            <StatusBadge status={h.status} />
                          </td>
                          <td>{h.health_status}</td>
                          <td>{h.created_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}

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
      </div>
    </>
  )
}
