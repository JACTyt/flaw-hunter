import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, FileText, Trash2, ShieldAlert, ShieldCheck, Sparkles, Eraser, List } from 'lucide-react'
import { getCampaign, startCampaign, stopCampaign, restartCampaign, deleteCampaign, getReport, clearAttackLog, startBatchAnalysis, getBatchAnalysisStatus, useCampaignEvents } from '../api'
import { AttackLogEntry } from '../components/AttackLogEntry'
import { SeverityBadge } from '../components/SeverityBadge'
import type { Campaign, Report, BatchAnalysisStatus } from '../types'

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

const riskColors: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-900',
  high:     'bg-orange-50 border-orange-300 text-orange-900',
  medium:   'bg-yellow-50 border-yellow-300 text-yellow-900',
  low:      'bg-blue-50 border-blue-300 text-blue-900',
  info:     'bg-gray-50 border-gray-300 text-gray-900',
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const campaignId = Number(id)
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [wsKey, setWsKey] = useState(0)
  const [batchAnalysis, setBatchAnalysis] = useState<BatchAnalysisStatus | null>(null)
  const events = useCampaignEvents(campaignId, wsKey)

  const refresh = () => getCampaign(campaignId).then(setCampaign)

  useEffect(() => { refresh() }, [campaignId])

  // Poll while running so status badge updates when the campaign finishes
  useEffect(() => {
    if (!campaign || campaign.status !== 'running') return
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [campaign?.status])

  // Poll batch analysis status while it's running
  useEffect(() => {
    if (batchAnalysis?.status !== 'running') return
    const timer = setInterval(async () => {
      const s = await getBatchAnalysisStatus(campaignId)
      setBatchAnalysis(s)
      if (s.status === 'done') {
        // Reload events and report from DB
        setWsKey((k) => k + 1)
        setReportLoading(true)
        getReport(campaignId).then(setReport).catch(() => setReport(null)).finally(() => setReportLoading(false))
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [batchAnalysis?.status, campaignId])

  // Load report once completed (report may take a moment to generate after completion)
  useEffect(() => {
    if (!campaign || (campaign.status !== 'completed' && campaign.status !== 'stopped')) return
    setReportLoading(true)
    getReport(campaignId)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false))
  }, [campaign?.status, campaignId])

  const handleRestart = async () => {
    setReport(null)
    await restartCampaign(campaignId)
    setWsKey((k) => k + 1)
    refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this campaign and all its data?')) return
    await deleteCampaign(campaignId)
    navigate('/campaigns')
  }

  const successCount = events.filter((e) => e.success).length
  const lastEvent = events.length > 0 ? events[events.length - 1] : null

  const { progress, stateLabel, subLabel, etaText } = useMemo(() => {
    if (!campaign) return { progress: 0, stateLabel: '', subLabel: '', etaText: null }

    const totalSlots = campaign.max_rounds * campaign.attack_types.length * campaign.max_retries
    const pct = campaign.status === 'completed'
      ? 100
      : totalSlots > 0 ? Math.min((events.length / totalSlots) * 100, 99) : 0

    let state = ''
    let sub = ''
    let eta: string | null = null

    if (campaign.status === 'running') {
      if (lastEvent) {
        state = `Testing: ${lastEvent.attack_type.replace(/_/g, ' ')}`
        sub = `Round ${lastEvent.round + 1} of ${campaign.max_rounds} · attempt ${lastEvent.attempt + 1} of ${campaign.max_retries}`
      } else {
        state = 'Starting…'
        sub = 'Waiting for first attack'
      }
      if (events.length >= 2) {
        const firstTs = new Date(events[0].timestamp).getTime()
        const lastTs = new Date(events[events.length - 1].timestamp).getTime()
        const msPerAttack = (lastTs - firstTs) / (events.length - 1)
        const remaining = Math.max(0, totalSlots - events.length)
        const etaMs = remaining * msPerAttack
        if (etaMs > 0) eta = `~${formatDuration(etaMs)} remaining`
      }
      if (pct >= 99) {
        state = 'Generating analysis…'
        sub = 'All attacks done · finalising report'
        eta = null
      }
    } else if (campaign.status === 'completed') {
      state = 'Completed'
      sub = `${successCount} of ${events.length} attacks successful`
      if (campaign.completed_at) {
        const endMs = new Date(campaign.completed_at).getTime()
        const startMs = new Date(campaign.created_at).getTime()
        eta = `Finished in ${formatDuration(endMs - startMs)}`
      }
    } else if (campaign.status === 'stopped') {
      state = 'Stopped'
      sub = `${events.length} attacks ran · ${successCount} successful`
    } else if (campaign.status === 'failed') {
      state = 'Failed'
      sub = 'See error entries in the attack log below'
    } else {
      state = campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)
    }

    return { progress: pct, stateLabel: state, subLabel: sub, etaText: eta }
  }, [campaign, events, successCount, lastEvent])

  if (!campaign) return <div className="p-8 text-gray-400">Loading…</div>

  const barColor =
    campaign.status === 'completed' ? 'bg-green-500' :
    campaign.status === 'stopped'   ? 'bg-yellow-500' :
    campaign.status === 'failed'    ? 'bg-red-500' :
    'bg-blue-600'

  const isDone = campaign.status === 'completed' || campaign.status === 'stopped'

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/campaigns" className="text-gray-400 hover:text-gray-600 text-sm">← Campaigns</Link>
        <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
          campaign.status === 'running'   ? 'bg-blue-100 text-blue-700'   :
          campaign.status === 'completed' ? 'bg-green-100 text-green-700' :
          campaign.status === 'stopped'   ? 'bg-yellow-100 text-yellow-700' :
          campaign.status === 'failed'    ? 'bg-red-100 text-red-700'     :
                                            'bg-gray-100 text-gray-700'
        }`}>
          {campaign.status}
        </span>
      </div>

      <div className="flex gap-3 mb-6">
        {campaign.status === 'pending' && (
          <button onClick={() => startCampaign(campaignId).then(refresh)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
            <Play size={15} />
            Start
          </button>
        )}
        {campaign.status === 'running' && (
          <button onClick={() => stopCampaign(campaignId).then(refresh)}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 flex items-center gap-1.5">
            <Square size={15} />
            Stop
          </button>
        )}
        {isDone && (
          <button onClick={handleRestart}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
            <RotateCcw size={15} />
            Restart
          </button>
        )}
        {campaign.status === 'completed' && (
          <Link to={`/reports/${campaignId}`}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 flex items-center gap-1.5">
            <FileText size={15} />
            Full Report
          </Link>
        )}
        {campaign.status !== 'running' && (
          <button onClick={handleDelete}
            className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded text-sm font-medium hover:bg-red-50 ml-auto flex items-center gap-1.5">
            <Trash2 size={15} />
            Delete
          </button>
        )}
      </div>

      {/* Progress panel */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">{stateLabel}</p>
            {subLabel && <p className="text-xs text-gray-500 mt-0.5">{subLabel}</p>}
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <p className="text-sm font-semibold text-gray-800">{Math.round(progress)}%</p>
            {etaText && <p className="text-xs text-gray-500 mt-0.5">{etaText}</p>}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>
            {events.length} attacks total
            {campaign.attack_types.length > 0 && <> · {campaign.attack_types.join(', ')}</>}
          </span>
          {campaign.completed_at && (
            <span>{new Date(campaign.completed_at).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Inline results — shown once campaign is done */}
      {isDone && (
        <div className="mb-6">
          {reportLoading && (
            <div className="bg-white rounded-lg shadow p-5 text-sm text-gray-400">
              Generating analysis…
            </div>
          )}

          {!reportLoading && report && (
            <>
              {/* LLM analysis banner */}
              {report.llm_analysis && (
                <div className={`border rounded-lg p-5 mb-4 ${riskColors[report.llm_analysis.overall_risk] ?? riskColors.info}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-base flex items-center gap-2">
                      {report.llm_analysis.breached
                        ? <><ShieldAlert size={18} /> Target Breached</>
                        : <><ShieldCheck size={18} /> No Breach Detected</>}
                    </span>
                    <SeverityBadge severity={report.llm_analysis.overall_risk} />
                  </div>
                  <p className="text-sm mb-3">{report.llm_analysis.opinion}</p>
                  {report.llm_analysis.key_findings.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Key Findings</p>
                      <ul className="list-disc list-inside space-y-0.5 text-sm">
                        {report.llm_analysis.key_findings.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {report.llm_analysis.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Recommendations</p>
                      <ul className="list-disc list-inside space-y-0.5 text-sm">
                        {report.llm_analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Vulnerabilities */}
              {report.vulnerabilities.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
                  <div className="px-5 py-3 border-b bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700">
                      Vulnerabilities Found ({report.vulnerabilities.length})
                    </h2>
                  </div>
                  {report.vulnerabilities.map((v, i) => (
                    <div key={i} className="px-5 py-4 border-b last:border-b-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-mono text-sm font-medium text-gray-800">{v.type}</span>
                        <SeverityBadge severity={v.severity} />
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Evidence:</span> {v.evidence}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Payload:</span>{' '}
                        <code className="bg-gray-100 px-1 rounded text-xs">{v.payload}</code>
                      </p>
                      <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                        <span className="font-medium">Fix:</span> {v.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {report.vulnerabilities.length === 0 && (
                <div className="bg-white rounded-lg shadow p-5 text-sm text-gray-400 text-center mb-4">
                  No vulnerabilities found in this run.
                </div>
              )}
            </>
          )}

          {!reportLoading && !report && (
            <div className="bg-white rounded-lg shadow p-5 text-sm text-gray-400">
              Report not available yet — analysis may still be running.
            </div>
          )}
        </div>
      )}

      {/* Attack log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2"><List size={18} /> Attack Log</h2>
          {events.length > 0 && campaign.status !== 'running' && (
            <div className="flex items-center gap-2">
              {/* Batch analysis progress */}
              {batchAnalysis?.status === 'running' && (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: batchAnalysis.total > 0 ? `${(batchAnalysis.completed / batchAnalysis.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    Analysing {batchAnalysis.completed}/{batchAnalysis.total}…
                  </span>
                </div>
              )}
              {batchAnalysis?.status === 'done' && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ {batchAnalysis.results.filter(r => !r.error).length}/{batchAnalysis.total} analysed
                </span>
              )}
              <button
                onClick={async () => {
                  await startBatchAnalysis(campaignId)
                  setBatchAnalysis({ status: 'running', total: events.length, completed: 0, results: [] })
                }}
                disabled={batchAnalysis?.status === 'running'}
                className={`px-3 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1 ${
                  batchAnalysis?.status === 'running'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                }`}
              >
                <Sparkles size={12} />
                Full analysis
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Clear all ${events.length} attack records? This cannot be undone.`)) return
                  await clearAttackLog(campaignId)
                  setWsKey((k) => k + 1)
                }}
                className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded hover:bg-gray-50 hover:text-red-600 hover:border-red-300 transition-colors flex items-center gap-1"
              >
                <Eraser size={12} />
                Clear log
              </button>
            </div>
          )}
        </div>
        {events.length === 0 && <p className="text-gray-400 text-sm">No attacks yet.</p>}
        {[...events].reverse().map((e, i) => (
          <AttackLogEntry key={i} event={e} />
        ))}
      </div>
    </div>
  )
}
