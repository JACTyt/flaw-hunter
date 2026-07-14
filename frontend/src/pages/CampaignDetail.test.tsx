import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as api from '../api'
import { CampaignDetail } from './CampaignDetail'
import type { Campaign } from '../types'

vi.mock('../api')

const campaign: Campaign = {
  id: 3, name: 'Detail Test', target_url: 'http://t',
  attack_types: ['prompt_injection'],
  status: 'running', max_rounds: 5, max_retries: 3,
  created_at: '2026-05-24', completed_at: null,
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/campaigns/3']}>
      <Routes>
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CampaignDetail', () => {
  it('renders campaign name', async () => {
    vi.mocked(api.getCampaign).mockResolvedValue(campaign)
    vi.mocked(api.useCampaignEvents).mockReturnValue([])
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('Detail Test')).toBeInTheDocument())
  })

  it('shows status badge', async () => {
    vi.mocked(api.getCampaign).mockResolvedValue(campaign)
    vi.mocked(api.useCampaignEvents).mockReturnValue([])
    renderWithRoute()
    await waitFor(() => expect(screen.getByText('running')).toBeInTheDocument())
  })

  it('shows empty log message when no events', async () => {
    vi.mocked(api.getCampaign).mockResolvedValue(campaign)
    vi.mocked(api.useCampaignEvents).mockReturnValue([])
    renderWithRoute()
    await waitFor(() => expect(screen.getByText(/No attacks yet/)).toBeInTheDocument())
  })
})
