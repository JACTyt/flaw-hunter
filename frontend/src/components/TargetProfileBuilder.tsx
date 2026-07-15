import { useEffect, useRef, useState } from 'react'
import { testTarget } from '../api'
import { parseCurl } from '../lib/curl'
import type { TargetProfile, TestTargetResult } from '../types'

type HeaderRow = { key: string; value: string }

const PRESETS: Record<string, Partial<TargetProfile> | null> = {
  Custom: null,
  'OpenAI-compatible': {
    method: 'POST',
    url: 'https://api.example.com/v1/chat/completions',
    headers: { Authorization: 'Bearer ${TARGET_API_KEY}', 'Content-Type': 'application/json' },
    body_template: { model: 'gpt-4o', messages: [{ role: 'user', content: '{message}' }] },
    response_path: 'choices.0.message.content',
    tool_calls_path: null,
  },
  Anthropic: {
    method: 'POST',
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'x-api-key': '${TARGET_API_KEY}', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body_template: { model: 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [{ role: 'user', content: '{message}' }] },
    response_path: 'content.0.text',
    tool_calls_path: null,
  },
  Ollama: {
    method: 'POST',
    url: 'http://localhost:11434/api/chat',
    headers: { 'Content-Type': 'application/json' },
    body_template: { model: 'llama3.2', stream: false, messages: [{ role: 'user', content: '{message}' }] },
    response_path: 'message.content',
    tool_calls_path: null,
  },
}

const toRows = (h: Record<string, string>): HeaderRow[] =>
  Object.entries(h).map(([key, value]) => ({ key, value }))
const toHeaders = (rows: HeaderRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.value]))

export function TargetProfileBuilder(
  { value, onChange }: { value: TargetProfile | null; onChange: (p: TargetProfile | null) => void },
) {
  const [enabled, setEnabled] = useState(!!value)
  const [method, setMethod] = useState(value?.method ?? 'POST')
  const [url, setUrl] = useState(value?.url ?? '')
  const [rows, setRows] = useState<HeaderRow[]>(value ? toRows(value.headers) : [{ key: '', value: '' }])
  const [bodyText, setBodyText] = useState(
    value ? JSON.stringify(value.body_template, null, 2)
          : '{\n  "messages": [{ "role": "user", "content": "{message}" }]\n}')
  const [responsePath, setResponsePath] = useState(value?.response_path ?? '')
  const [toolCallsPath, setToolCallsPath] = useState(value?.tool_calls_path ?? '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestTargetResult | null>(null)
  const [curlText, setCurlText] = useState('')

  let bodyValid = true
  let bodyParsed: unknown = {}
  try { bodyParsed = JSON.parse(bodyText) } catch { bodyValid = false }

  const build = (): TargetProfile | null => {
    if (!enabled || !url || !bodyValid || !responsePath) return null
    return {
      method, url, headers: toHeaders(rows), body_template: bodyParsed,
      response_path: responsePath, tool_calls_path: toolCallsPath || null,
    }
  }

  // Emit the current profile to the parent whenever any input changes.
  // A ref holds the latest onChange so it stays out of the effect deps
  // (an inline parent callback would otherwise loop every render).
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    onChangeRef.current(build())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, method, url, rows, bodyText, responsePath, toolCallsPath])

  const importCurl = () => {
    const p = parseCurl(curlText)
    if (p.method) setMethod(p.method)
    if (p.url) setUrl(p.url)
    if (Object.keys(p.headers).length) setRows(toRows(p.headers))
    if (p.body != null) {
      let pretty = p.body
      try { pretty = JSON.stringify(JSON.parse(p.body), null, 2) } catch { /* keep raw */ }
      setBodyText(pretty)
    }
  }

  const applyPreset = (name: string) => {
    const p = PRESETS[name]
    if (!p) return
    setMethod(p.method ?? 'POST')
    setUrl(p.url ?? '')
    setRows(toRows(p.headers ?? {}))
    setBodyText(JSON.stringify(p.body_template ?? {}, null, 2))
    setResponsePath(p.response_path ?? '')
    setToolCallsPath(p.tool_calls_path ?? '')
  }

  const runTest = async () => {
    const profile = build()
    if (!profile) return
    setTesting(true); setResult(null)
    try { setResult(await testTarget(profile, 'Hello, what can you do?')) }
    catch { setResult({ status_code: 0, raw_response: 'request failed', extracted_reply: '', matched: false }) }
    finally { setTesting(false) }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" aria-label="enable external target"
               checked={enabled}
               onChange={(e) => setEnabled(e.target.checked)} />
        Advanced: External target
      </label>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1" htmlFor="curl">
              Import from cURL — paste "Copy as cURL" from browser DevTools
            </label>
            <textarea id="curl" aria-label="cURL command" rows={2} value={curlText}
                      onChange={(e) => setCurlText(e.target.value)}
                      placeholder="curl 'https://…' -H '…' --data-raw '…'"
                      className="border rounded px-2 py-1 text-xs font-mono w-full" />
            <button type="button" onClick={importCurl}
                    className="mt-1 px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50">
              Import
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {'Then replace your typed message in the body with {message} and set the reply path.'}
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1" htmlFor="tpl">Template</label>
            <select id="tpl" aria-label="Template" className="border rounded px-2 py-1 text-sm"
                    onChange={(e) => applyPreset(e.target.value)} defaultValue="Custom">
              {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <select aria-label="Method" value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="border rounded px-2 py-1 text-sm">
              <option>POST</option><option>GET</option><option>PUT</option>
            </select>
            <input aria-label="URL" placeholder="https://target/api/chat" value={url}
                   onChange={(e) => setUrl(e.target.value)}
                   className="border rounded px-2 py-1 text-sm flex-1" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{'Headers — use ${ENV_VAR} for secrets'}</span>
              <button type="button" className="text-xs text-blue-600"
                      onClick={() => setRows([...rows, { key: '', value: '' }])}>+ add header</button>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input aria-label={`header-key-${i}`} value={r.key} placeholder="Header"
                       onChange={(e) => { const n = [...rows]; n[i] = { ...r, key: e.target.value }; setRows(n) }}
                       className="border rounded px-2 py-1 text-sm w-1/3" />
                <input aria-label={`header-value-${i}`} value={r.value} placeholder="Value"
                       onChange={(e) => { const n = [...rows]; n[i] = { ...r, value: e.target.value }; setRows(n) }}
                       className="border rounded px-2 py-1 text-sm flex-1" />
                <button type="button" className="text-xs text-red-500"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}>remove</button>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500" htmlFor="body">Body template (JSON)</label>
              <span className={`text-xs ${bodyValid ? 'text-green-600' : 'text-red-500'}`}>
                {bodyValid ? '● valid' : '✕ invalid JSON'}
              </span>
            </div>
            <textarea id="body" aria-label="Body template" rows={5} value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      className="border rounded px-2 py-1 text-xs font-mono w-full" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1" htmlFor="rp">Reply path</label>
              <input id="rp" aria-label="Reply path" value={responsePath}
                     onChange={(e) => setResponsePath(e.target.value)}
                     placeholder="choices.0.message.content"
                     className="border rounded px-2 py-1 text-sm w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1" htmlFor="tcp">Tool-calls path (optional)</label>
              <input id="tcp" aria-label="Tool-calls path" value={toolCallsPath}
                     onChange={(e) => setToolCallsPath(e.target.value)}
                     className="border rounded px-2 py-1 text-sm w-full" />
            </div>
          </div>

          <div>
            <button type="button" disabled={!build() || testing}
                    onClick={runTest}
                    className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:bg-gray-300">
              {testing ? 'Testing…' : '⚡ Test target'}
            </button>
            {result && (
              <div className="mt-2 text-xs border rounded p-2 bg-gray-50">
                <div>Status: {result.status_code} {result.matched ? '✓' : '✕'}</div>
                <div className="mt-1"><span className="text-gray-500">Extracted reply:</span> {result.extracted_reply || '(empty — check reply path)'}</div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-gray-500">{result.raw_response.slice(0, 400)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
