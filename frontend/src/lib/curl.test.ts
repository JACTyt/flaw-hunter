import { describe, it, expect } from 'vitest'
import { parseCurl } from './curl'

describe('parseCurl', () => {
  it('parses a Chrome "Copy as cURL" (bash) command', () => {
    const c = `curl 'https://api.example.com/v1/chat' \\
      -H 'Authorization: Bearer sk-abc' \\
      -H 'content-type: application/json' \\
      --data-raw '{"model":"m","messages":[{"role":"user","content":"hi"}]}'`
    const p = parseCurl(c)
    expect(p.url).toBe('https://api.example.com/v1/chat')
    expect(p.method).toBe('POST')
    expect(p.headers['Authorization']).toBe('Bearer sk-abc')
    expect(p.headers['content-type']).toBe('application/json')
    expect(p.body).toContain('"content":"hi"')
  })

  it('defaults to GET when no body', () => {
    expect(parseCurl("curl 'https://x/y'").method).toBe('GET')
  })

  it('respects explicit -X even with a body', () => {
    expect(parseCurl("curl -X GET 'https://x/y' --data-raw 'z'").method).toBe('GET')
  })

  it('parses double-quoted tokens and --header/--data', () => {
    const p = parseCurl('curl "https://x/y" --header "K: V" --data "{\\"a\\":1}"')
    expect(p.url).toBe('https://x/y')
    expect(p.headers['K']).toBe('V')
    expect(p.body).toBe('{"a":1}')
    expect(p.method).toBe('POST')
  })

  it('handles the --url flag and ignores unknown flags', () => {
    const p = parseCurl("curl --compressed --url 'https://z/api' -H 'X: 1'")
    expect(p.url).toBe('https://z/api')
    expect(p.headers['X']).toBe('1')
  })
})
