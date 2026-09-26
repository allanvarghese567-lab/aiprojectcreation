import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    consoleUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-proj-...',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    consoleUrl: 'https://console.x.ai/',
    placeholder: 'xai-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
]

export default function VendorKeys() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [name, setName] = useState('Default')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_vendor_keys')
      .select('id, provider, name, key_prefix, key_hint, source, is_active, created_at')
      .order('created_at', { ascending: false })
    setKeys(data || [])
    setLoading(false)
  }

  function openProvider(provider) {
    setSelectedProvider(provider)
    setName('Default')
    setApiKey('')
    setError('')
    setSuccess('')
  }

  function openOfficialConsole() {
    if (selectedProvider) {
      window.open(selectedProvider.consoleUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!apiKey.trim() || !selectedProvider) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase.functions.invoke('save-vendor-key', {
        body: {
          provider: selectedProvider.id,
          name: name || 'Default',
          api_key: apiKey.trim(),
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setSuccess(`${selectedProvider.label} key saved successfully!`)
      setApiKey('')
      loadKeys()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteKey(id) {
    if (!confirm('Delete this key permanently?')) return
    await supabase.from('ai_vendor_keys').delete().eq('id', id)
    loadKeys()
  }

  return (
    <div style={{ padding: '1.25rem' }}>
      <h3 style={{ marginBottom: '1.25rem' }}>AI Vendor API Keys</h3>

      {/* Provider buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`small-btn ${selectedProvider?.id === p.id ? 'success' : ''}`}
            onClick={() => openProvider(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* In-app panel */}
      {selectedProvider && (
        <div className="vendor-key-form">
          <h4 style={{ marginBottom: '0.5rem' }}>
            Add {selectedProvider.label} Key
          </h4>

          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            1. Click the button below to open the official console<br />
            2. Create / copy your API key<br />
            3. Paste it here and save
          </p>

          <button
            type="button"
            className="small-btn"
            style={{ marginBottom: '1rem', width: '100%' }}
            onClick={openOfficialConsole}
          >
            Open {selectedProvider.label} Console ↗
          </button>

          <form onSubmit={handleSave}>
            <div className="form-row">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Key"
              />
            </div>

            <div className="form-row">
              <label>Paste API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider.placeholder}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="small-btn" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving...' : 'Save Key'}
            </button>
          </form>
        </div>
      )}

      {/* Saved keys list */}
      {loading ? (
        <div className="loading">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="empty">No vendor keys saved yet</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Name</th>
              <th>Key</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td style={{ textTransform: 'capitalize' }}>{k.provider}</td>
                <td>{k.name}</td>
                <td className="mono">{k.key_prefix}...{k.key_hint}</td>
                <td>
                  <span className={`status ${k.is_active ? 'active' : 'paused'}`}>
                    {k.is_active ? 'active' : 'disabled'}
                  </span>
                </td>
                <td>{new Date(k.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    className="small-btn"
                    style={{ background: '#7f1d1d' }}
                    onClick={() => deleteKey(k.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
