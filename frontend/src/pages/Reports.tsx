import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Download, ShieldAlert, ShieldCheck, Bug } from 'lucide-react'
import { getReport } from '../api'
import { SeverityBadge } from '../components/SeverityBadge'
import type { Report } from '../types'

const riskColors: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-900',
  high:     'bg-orange-50 border-orange-300 text-orange-900',
  medium:   'bg-yellow-50 border-yellow-300 text-yellow-900',
  low:      'bg-blue-50 border-blue-300 text-blue-900',
  info:     'bg-gray-50 border-gray-300 text-gray-900',
}

export function Reports() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => { getReport(Number(id)).then(setReport) }, [id])

  if (!report) return <div className="p-8 text-gray-400">Loading...</div>

  const { summary, vulnerabilities, llm_analysis } = report
  const successRate = Math.round((summary.exploit_success_rate ?? 0) * 100)
  const coverage = Math.round((summary.coverage ?? 0) * 100)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-campaign-${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/campaigns" className="text-gray-400 hover:text-gray-600 text-sm">← Campaigns</Link>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Report #{id}</h1>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
        >
          <Download size={15} />
          Export JSON
        </button>
      </div>

      {llm_analysis && (
        <div className={`border rounded-lg p-6 mb-8 ${riskColors[llm_analysis.overall_risk] ?? riskColors.info}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-lg font-bold flex items-center gap-2">
              {llm_analysis.breached
                ? <><ShieldAlert size={20} /> Target Breached</>
                : <><ShieldCheck size={20} /> No Breach Detected</>}
            </span>
            <SeverityBadge severity={llm_analysis.overall_risk} />
          </div>
          <p className="text-sm mb-4">{llm_analysis.opinion}</p>
          {llm_analysis.key_findings.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">Key Findings</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {llm_analysis.key_findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {llm_analysis.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">Recommendations</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {llm_analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Attacks', value: summary.total_attacks,  color: 'text-gray-900' },
          { label: 'Successful',    value: summary.successful,      color: 'text-green-600' },
          { label: 'Exploit Rate',  value: `${successRate}%`,       color: 'text-orange-600' },
          { label: 'Coverage',      value: `${coverage}%`,          color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg shadow p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Bug size={18} />
            Vulnerabilities ({vulnerabilities.length})
          </h2>
        </div>
        {vulnerabilities.length === 0 && (
          <p className="p-8 text-center text-gray-400">No vulnerabilities found.</p>
        )}
        {vulnerabilities.map((v, i) => (
          <div key={i} className="p-4 border-b last:border-b-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-medium">{v.type}</span>
              <SeverityBadge severity={v.severity} />
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Evidence:</span> {v.evidence}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">Payload:</span>{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">{v.payload}</code>
            </p>
            <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
              <span className="font-medium">Recommendation:</span> {v.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
