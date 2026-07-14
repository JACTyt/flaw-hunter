import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as api from '../api'
import { Reports } from './Reports'
import type { Report } from '../types'

vi.mock('../api')

const report: Report = {
  campaign_id: 1,
  target_url: 'http://localhost:8001',
  summary: { total_attacks: 10, successful: 4, exploit_success_rate: 0.4, coverage: 0.75 },
  vulnerabilities: [
    {
      type: 'prompt_injection', severity: 'high',
      evidence: 'leaked prompt', payload: 'Ignore...',
      recommendation: 'Add input filtering',
    },
  ],
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/reports/1']}>
      <Routes>
        <Route path="/reports/:id" element={<Reports />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Reports', () => {
  it('renders exploit success rate as percentage', async () => {
    vi.mocked(api.getReport).mockResolvedValue(report)
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('40%')).toBeInTheDocument())
  })

  it('renders vulnerability type', async () => {
    vi.mocked(api.getReport).mockResolvedValue(report)
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('prompt_injection')).toBeInTheDocument())
  })

  it('renders recommendation text', async () => {
    vi.mocked(api.getReport).mockResolvedValue(report)
    renderWithRoute()
    await waitFor(() => expect(screen.getByText(/Add input filtering/)).toBeInTheDocument())
  })
})
