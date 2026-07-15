import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TargetProfileBuilder } from './TargetProfileBuilder'
import * as api from '../api'

vi.mock('../api')

describe('TargetProfileBuilder', () => {
  it('is disabled by default and emits null', () => {
    const onChange = vi.fn()
    render(<TargetProfileBuilder value={null} onChange={onChange} />)
    expect(screen.getByText(/External target/i)).toBeInTheDocument()
    // body editor hidden until enabled
    expect(screen.queryByLabelText('Reply path')).not.toBeInTheDocument()
  })

  it('enabling and picking a preset fills the reply path', () => {
    const onChange = vi.fn()
    render(<TargetProfileBuilder value={null} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText(/enable external target/i))
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'OpenAI-compatible' } })
    expect((screen.getByLabelText('Reply path') as HTMLInputElement).value)
      .toBe('choices.0.message.content')
  })

  it('imports fields from a pasted cURL command', () => {
    render(<TargetProfileBuilder value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/enable external target/i))
    fireEvent.change(screen.getByLabelText('cURL command'), { target: {
      value: `curl 'https://imported.example/api' -H 'X-Key: abc' --data-raw '{"q":"hi"}'` } })
    fireEvent.click(screen.getByText('Import'))
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('https://imported.example/api')
    expect((screen.getByLabelText('Body template') as HTMLTextAreaElement).value).toContain('"q": "hi"')
    expect((screen.getByLabelText('header-value-0') as HTMLInputElement).value).toBe('abc')
  })

  it('Test target renders the extracted reply', async () => {
    vi.mocked(api.testTarget).mockResolvedValue({
      status_code: 200, raw_response: '{"data":{"reply":"pong"}}',
      extracted_reply: 'pong', matched: true })
    render(<TargetProfileBuilder value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/enable external target/i))
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'OpenAI-compatible' } })
    fireEvent.click(screen.getByText(/Test target/i))
    await waitFor(() => expect(screen.getByText('pong')).toBeInTheDocument())
  })
})
