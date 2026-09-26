import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'xai', label: 'xAI (Grok)' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'google', label: 'Google (Gemini)' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'groq', label: 'Groq' },
  { id: 'other', label: 'Other' },
]

export default function VendorKeys() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [provider, setProvider] = useState('openai')
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
    const { data, error } = await supabase
      .from('ai_vendor_keys')
      .select('id, provider, name, key_prefix, key_hint, source, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) console.error(error)
    setKeys(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!apiKey.trim()) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase.functions.invoke('save-vendor-key', {
        body: {
          provider,
          name: name || 'Default',
          api_key: apiKey.trim(),
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setSuccess(`${provider} key saved successfully`)
      setApiKey('')
      setName('Default')
      setShowForm(false)
      loadKeys()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id, current) {
    const { error } = await supabase
      .from('ai_vendor_keys')
      .update({ is_active: !current })
      .eq('id', id)

    if (!error) loadKeys()
  }

  async function deleteKey(id) {
    if (!confirm('Delete this key permanently?')) return

    const { error } = await supabase
      .from('ai_vendor_keys')
      .delete()
      .eq('id', id)

    if (!error) loadKeys()
  }

  return (
    <div style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem' }}>AI Vendor API Keys</h3>
        <button className="small-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Key'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="vendor-key-form">
          <div className="form-row">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Key"
            />
          </div>

          <div className="form-row">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... or xai-... or AIza..."
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="small-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </form>
      )}

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
              <th>Source</th>
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
                <td className="mono">
                  {k.key_prefix}...{k.key_hint}
                </td>
                <td>{k.source}</td>
                <td>
                  <span className={`status ${k.is_active ? 'active' : 'paused'}`}>
                    {k.is_active ? 'active' : 'disabled'}
                  </span>
                </td>
                <td>{new Date(k.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="small-btn"
                      onClick={() => toggleActive(k.id, k.is_active)}
                    >
                      {k.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="small-btn"
                      style={{ background: '#7f1d1d' }}
                      onClick={() => deleteKey(k.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
