import { useState } from 'react'
import { CheckCircle2, Circle, AlertCircle, Microscope, ChevronDown, ChevronUp } from 'lucide-react'
import type { AttackEvent, AttackAnalysisResult } from '../types'
import { SeverityBadge } from './SeverityBadge'
import { analyzeAttack } from '../api'

export function AttackLogEntry({ event }: { event: AttackEvent }) {
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AttackAnalysisResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setAnalyzing(true)
    setAnalysis(null)
    setAnalyzeError(null)
    try {
      const result = await analyzeAttack(event.payload, event.response, event.attack_type)
      setAnalysis(result)
    } catch {
      setAnalyzeError('Analysis failed — LLM may be unavailable')
    } finally {
      setAnalyzing(false)
    }
  }

  if (event.error) {
    return (
      <div className="border border-red-200 rounded-lg mb-2 bg-red-50 p-3">
        <div className="flex items-center gap-3">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <span className="font-mono text-sm text-red-700">
            {event.attack_type || 'error'} — R{event.round}/A{event.attempt}
          </span>
          <span className="text-xs text-red-500 font-medium">LLM error</span>
        </div>
        <p className="text-xs text-red-600 mt-1 ml-5 font-mono">{event.response}</p>
      </div>
    )
  }

  const confidencePct = analysis ? Math.round(analysis.confidence * 100) : null

  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {(analysis?.success ?? event.success)
            ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
            : <Circle size={14} className="text-gray-300 flex-shrink-0" />}
          <span className="font-mono text-sm text-gray-700">{event.attack_type}</span>
          <span className="text-xs text-gray-400">R{event.round}/A{event.attempt}</span>
          {(analysis?.success ?? event.success) && (
            <span className="text-xs text-green-600 font-medium">success</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={analysis?.severity ?? event.severity} />
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1 ${
              analyzing
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Microscope size={11} />
            {analyzing ? 'Analysing…' : 'Analyse'}
          </button>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t p-4 space-y-3 bg-gray-50">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Payload</p>
            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap">{event.payload}</pre>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Response</p>
            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap">{event.response}</pre>
          </div>
          {event.success && !analysis && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Evidence</p>
              <p className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">{event.evidence}</p>
            </div>
          )}

          {/* Fresh analysis result */}
          {analyzeError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {analyzeError}
            </div>
          )}
          {analysis && (
            <div className="bg-white rounded border p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Analysis</span>
                <SeverityBadge severity={analysis.severity} />
                {confidencePct !== null && (
                  <span className="text-xs text-gray-400">{confidencePct}% confidence</span>
                )}
                <span className={`text-xs font-medium ${analysis.success ? 'text-green-600' : 'text-gray-500'}`}>
                  {analysis.success ? '✓ Exploited' : '✗ Not exploited'}
                </span>
              </div>
              {analysis.evidence && (
                <p className="text-xs text-gray-700">
                  <span className="font-medium">Evidence:</span> {analysis.evidence}
                </p>
              )}
              {!analysis.success && analysis.failure_reason && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Why it failed:</span> {analysis.failure_reason}
                </p>
              )}
              {analysis.vulnerability_type && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Type:</span>{' '}
                  <code className="bg-gray-100 px-1 rounded">{analysis.vulnerability_type}</code>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
