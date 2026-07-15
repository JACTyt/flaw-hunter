import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import * as api from '../api'
import { Campaigns } from './Campaigns'
import type { Campaign } from '../types'

vi.mock('../api')

const campaigns: Campaign[] = [
  {
    id: 1, name: 'Alpha', target_url: 'http://localhost:8001',
    attack_types: ['prompt_injection'], status: 'completed',
    max_rounds: 3, max_retries: 2, explanation_verbosity: 'concise',
    created_at: '2026-05-24', completed_at: '2026-05-24',
  },
]

describe('Campaigns', () => {
  it('renders campaign list', async () => {
    vi.mocked(api.listCampaigns).mockResolvedValue(campaigns)
    render(<MemoryRouter><Campaigns /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
  })

  it('opens new campaign form on button click', async () => {
    vi.mocked(api.listCampaigns).mockResolvedValue([])
    render(<MemoryRouter><Campaigns /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Campaign'))
    fireEvent.click(screen.getByText('New Campaign'))
    expect(screen.getByLabelText('Campaign Name')).toBeInTheDocument()
  })

  it('submits new campaign form', async () => {
    vi.mocked(api.listCampaigns).mockResolvedValue([])
    vi.mocked(api.createCampaign).mockResolvedValue({
      id: 2, name: 'Beta', target_url: 'http://t',
      attack_types: ['goal_hijacking'], status: 'pending',
      max_rounds: 3, max_retries: 2, explanation_verbosity: 'concise',
      created_at: '2026-05-24', completed_at: null,
    })
    render(<MemoryRouter><Campaigns /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Campaign'))
    fireEvent.click(screen.getByText('New Campaign'))
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'Beta' } })
    fireEvent.change(screen.getByLabelText('Target URL'), { target: { value: 'http://t' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(api.createCampaign).toHaveBeenCalled())
  })
})
