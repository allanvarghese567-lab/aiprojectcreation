import { useMemo, useState } from 'react'
import { supabase } from '../supabase'

function StatusBadge({ status }) {
  return <span className={`status ${status}`}>{status}</span>
}

function buildTree(agents) {
  const byId = new Map(agents.map((a) => [a.id, { ...a, children: [] }]))
  const roots = []

  for (const agent of byId.values()) {
    if (agent.parent_agent_id && byId.has(agent.parent_agent_id)) {
      byId.get(agent.parent_agent_id).children.push(agent)
    } else {
      roots.push(agent)
    }
  }

  const sortByName = (list) => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((n) => sortByName(n.children))
  }
  sortByName(roots)

  return roots
}

function Node({ node, depth }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <div className="tree-node" style={{ marginLeft: depth * 20 }}>
      <div className="tree-row">
        {hasChildren ? (
          <button className="tree-toggle" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <span className="tree-level">L{node.level}</span>
        <strong>{node.name}</strong>
        <span className="mono tree-slug">{node.slug}</span>
        <StatusBadge status={node.status} />
        {hasChildren && <span className="tree-count">{node.children.length} agent(s)</span>}
      </div>
      {!collapsed &&
        node.children.map((child) => <Node key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}

export default function Hierarchy({ agents, onChanged }) {
  const tree = useMemo(() => buildTree(agents), [agents])
  const [form, setForm] = useState({ name: '', slug: '', parent_agent_id: '', status: 'draft' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const parentOptions = useMemo(
    () => agents.slice().sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [agents]
  )

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)

    const name = form.name.trim()
    const slug = form.slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (!name || !slug) {
      setFormError('Name is required.')
      return
    }

    const parent = agents.find((a) => a.id === form.parent_agent_id)
    const level = parent ? parent.level + 1 : 0

    setSubmitting(true)
    const { error } = await supabase.from('ai_agents').insert({
      name,
      slug,
      status: form.status,
      hosting_status: 'pending',
      created_by: 'dashboard',
      parent_agent_id: form.parent_agent_id || null,
      level,
    })
    setSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }

    setForm({ name: '', slug: '', parent_agent_id: '', status: 'draft' })
    onChanged?.()
  }

  return (
    <div className="hierarchy">
      <form className="hierarchy-form" onSubmit={handleCreate}>
        <input
          placeholder="Agent name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          placeholder="Slug (optional)"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
        />
        <select
          value={form.parent_agent_id}
          onChange={(e) => setForm((f) => ({ ...f, parent_agent_id: e.target.value }))}
        >
          <option value="">No parent (top level)</option>
          {parentOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {'— '.repeat(a.level)}
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="draft">draft</option>
          <option value="in_progress">in_progress</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="archived">archived</option>
        </select>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add agent'}
        </button>
      </form>
      {formError && <div className="hierarchy-error">{formError}</div>}

      <div className="tree">
        {tree.length === 0 ? (
          <div className="empty">No agents yet</div>
        ) : (
          tree.map((node) => <Node key={node.id} node={node} depth={0} />)
        )}
      </div>
    </div>
  )
}
