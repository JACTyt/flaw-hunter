import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { listCampaigns, getCampaign, createCampaign, startCampaign, stopCampaign, getReport, testTarget } from './api'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

describe('API client', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('listCampaigns calls GET /api/campaigns', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] })
    const result = await listCampaigns()
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/campaigns')
    expect(result).toEqual([])
  })

  it('createCampaign calls POST /api/campaigns with body', async () => {
    const payload = {
      name: 'test', target_url: 'http://t',
      attack_types: ['prompt_injection'] as const, max_rounds: 3, max_retries: 2,
      explanation_verbosity: 'concise' as const,
    }
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { id: 1, ...payload, status: 'pending' } })
    const result = await createCampaign(payload)
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/campaigns', payload)
    expect(result.id).toBe(1)
  })

  it('testTarget posts profile and message', async () => {
    const profile = { method: 'POST', url: 'http://x/c', headers: {},
      body_template: { q: '{message}' }, response_path: 'reply', tool_calls_path: null }
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { status_code: 200,
      raw_response: '{}', extracted_reply: 'hi', matched: true } })
    const r = await testTarget(profile, 'ping')
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/targets/test', { profile, message: 'ping' })
    expect(r.matched).toBe(true)
  })

  it('startCampaign calls POST /api/campaigns/5/start', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { status: 'started' } })
    await startCampaign(5)
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/campaigns/5/start')
  })

  it('getReport calls GET /api/campaigns/1/report', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: { campaign_id: 1, summary: {}, vulnerabilities: [] },
    })
    const result = await getReport(1)
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/campaigns/1/report')
    expect(result.campaign_id).toBe(1)
  })
})
