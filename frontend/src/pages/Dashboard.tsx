import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, Activity, CheckCircle2, ArrowRight } from 'lucide-react'
import { listCampaigns } from '../api'
import { MetricsCard } from '../components/MetricsCard'
import { SeverityBadge } from '../components/SeverityBadge'
import type { Campaign, Severity } from '../types'

const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const statusColors: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  stopped:   'bg-yellow-100 text-yellow-700',
  failed:    'bg-red-100 text-red-700',
}

export function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCampaigns().then((data) => { setCampaigns(data); setLoading(false) })
  }, [])

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>

  const total = campaigns.length
  const running = campaigns.filter((c) => c.status === 'running').length
  const completed = campaigns.filter((c) => c.status === 'completed').length
  const recent = campaigns.slice(0, 5)

  const zeroCounts = Object.fromEntries(ALL_SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <MetricsCard title="Total Campaigns" value={total} icon={<Crosshair size={20} className="text-blue-500" />} />
        <MetricsCard title="Running" value={running} icon={<Activity size={20} className="text-blue-500" />} />
        <MetricsCard title="Completed" value={completed} icon={<CheckCircle2 size={20} className="text-green-500" />} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Severity Distribution</h2>
          <div className="flex gap-4 flex-wrap">
            {ALL_SEVERITIES.map((sev) => (
              <div key={sev} className="flex items-center gap-2">
                <SeverityBadge severity={sev} />
                <span className="text-sm text-gray-600">{zeroCounts[sev]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Recent Campaigns</h2>
            <Link to="/campaigns" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400">No campaigns yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  className="flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{c.target_url}</p>
                  </div>
                  <span className={`ml-3 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status]}`}>
                    {c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
