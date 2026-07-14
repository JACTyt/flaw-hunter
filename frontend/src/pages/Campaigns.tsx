import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { listCampaigns, createCampaign, deleteCampaign, updateCampaign, restartCampaign } from '../api'
import type { Campaign, AttackType, CreateCampaignPayload } from '../types'

const ATTACK_TYPES: AttackType[] = [
  'prompt_injection', 'goal_hijacking', 'tool_misuse', 'data_exfiltration',
]

const statusColors: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  stopped:   'bg-yellow-100 text-yellow-700',
  failed:    'bg-red-100 text-red-700',
}

const emptyForm: CreateCampaignPayload = {
  name: '',
  target_url: 'http://localhost:8001',
  attack_types: ['prompt_injection'],
  max_rounds: 5,
  max_retries: 3,
}

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CreateCampaignPayload>(emptyForm)

  const load = () => listCampaigns().then(setCampaigns)

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId !== null) {
      await updateCampaign(editingId, form)
      setEditingId(null)
    } else {
      await createCampaign(form)
    }
    setShowForm(false)
    setForm(emptyForm)
    load()
  }

  const handleEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      target_url: c.target_url,
      attack_types: c.attack_types,
      max_rounds: c.max_rounds,
      max_retries: c.max_retries,
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this campaign and all its data?')) return
    await deleteCampaign(id)
    load()
  }

  const handleRestart = async (id: number) => {
    await restartCampaign(id)
    load()
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const toggleType = (t: AttackType) => {
    setForm((f) => ({
      ...f,
      attack_types: f.attack_types.includes(t)
        ? f.attack_types.filter((x) => x !== t)
        : [...f.attack_types, t],
    }))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button
          onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1.5"
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            {editingId !== null ? 'Edit Campaign' : 'New Campaign'}
          </h2>
          <div>
            <label htmlFor="cname" className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Name
            </label>
            <input
              id="cname"
              aria-label="Campaign Name"
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="turl" className="block text-sm font-medium text-gray-700 mb-1">
              Target URL
            </label>
            <input
              id="turl"
              aria-label="Target URL"
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              value={form.target_url}
              onChange={(e) => setForm({ ...form, target_url: e.target.value })}
              required
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Attack Types</p>
            <div className="flex flex-wrap gap-2">
              {ATTACK_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    form.attack_types.includes(t)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-600 border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Rounds</label>
              <input
                type="number" min={1} max={20}
                className="border rounded px-3 py-2 text-sm w-24"
                value={form.max_rounds}
                onChange={(e) => setForm({ ...form, max_rounds: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
              <input
                type="number" min={1} max={10}
                className="border rounded px-3 py-2 text-sm w-24"
                value={form.max_retries}
                onChange={(e) => setForm({ ...form, max_retries: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              {editingId !== null ? 'Save' : 'Create'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 rounded text-sm font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <Link to={`/campaigns/${c.id}`} className="flex-1 min-w-0 group">
                <p className="font-medium text-gray-900 group-hover:text-blue-600">{c.name}</p>
                <p className="text-sm text-gray-500 font-mono mt-1 truncate">{c.target_url}</p>
              </Link>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <span className="text-xs text-gray-400">{c.attack_types.length} types</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status]}`}>
                  {c.status}
                </span>
                {(c.status === 'completed' || c.status === 'stopped') && (
                  <button
                    onClick={() => handleRestart(c.id)}
                    className="px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    Restart
                  </button>
                )}
                {c.status !== 'running' && (
                  <button
                    onClick={() => handleEdit(c)}
                    className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 flex items-center gap-1"
                  title={c.status === 'running' ? 'Stop the campaign first' : 'Delete'}
                  disabled={c.status === 'running'}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-center text-gray-400 py-12">No campaigns yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
