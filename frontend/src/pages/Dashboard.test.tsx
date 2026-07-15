import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import * as api from '../api'
import { Dashboard } from './Dashboard'
import type { Campaign } from '../types'

vi.mock('../api')

const campaigns: Campaign[] = [
  {
    id: 1, name: 'Camp A', target_url: 'http://t',
    attack_types: ['prompt_injection', 'goal_hijacking'],
    status: 'completed', max_rounds: 3, max_retries: 2,
    explanation_verbosity: 'concise',
    created_at: '2026-05-24', completed_at: '2026-05-24',
  },
  {
    id: 2, name: 'Camp B', target_url: 'http://t',
    attack_types: ['data_exfiltration'],
    status: 'running', max_rounds: 5, max_retries: 3,
    explanation_verbosity: 'concise',
    created_at: '2026-05-24', completed_at: null,
  },
]

describe('Dashboard', () => {
  it('shows total campaigns count', async () => {
    vi.mocked(api.listCampaigns).mockResolvedValue(campaigns)
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
  })

  it('shows running metric label', async () => {
    vi.mocked(api.listCampaigns).mockResolvedValue(campaigns)
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument())
  })
})
