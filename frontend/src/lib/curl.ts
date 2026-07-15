export interface ParsedCurl {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

// Split a shell-ish command into tokens, honoring single/double quotes,
// backslash escapes, and line continuations (bash `\` and cmd `^`).
function tokenize(s: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let has = false // saw a (possibly empty) quoted token
  let inS = false
  let inD = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inS) {
      if (c === "'") inS = false
      else { cur += c }
      continue
    }
    if (inD) {
      if (c === '"') inD = false
      else if (c === '\\' && i + 1 < s.length) { cur += s[i + 1]; i++ }
      else { cur += c }
      continue
    }
    if (c === "'") { inS = true; has = true; continue }
    if (c === '"') { inD = true; has = true; continue }
    if ((c === '\\' || c === '^') && (s[i + 1] === '\n' || s[i + 1] === '\r')) { i++; continue }
    if (c === '\\' && i + 1 < s.length) { cur += s[i + 1]; has = true; i++; continue }
    if (/\s/.test(c)) {
      if (cur || has) { tokens.push(cur); cur = ''; has = false }
      continue
    }
    cur += c; has = true
  }
  if (cur || has) tokens.push(cur)
  return tokens
}

const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii'])

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input.trim())
  let method = ''
  let url = ''
  const headers: Record<string, string> = {}
  let body: string | null = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.toLowerCase() === 'curl') continue
    if (t === '-X' || t === '--request') { method = tokens[++i] ?? ''; continue }
    if (t === '-H' || t === '--header') {
      const h = tokens[++i] ?? ''
      const idx = h.indexOf(':')
      if (idx > 0) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim()
      continue
    }
    if (DATA_FLAGS.has(t)) { body = tokens[++i] ?? ''; continue }
    if (t === '--url') { url = tokens[++i] ?? ''; continue }
    if (t === '-b' || t === '--cookie') { headers['Cookie'] = tokens[++i] ?? ''; continue }
    if (t.startsWith('-')) continue // unknown flag — skip (no value consumed)
    if (!url) url = t
  }

  if (!method) method = body != null ? 'POST' : 'GET'
  return { method, url, headers, body }
}
