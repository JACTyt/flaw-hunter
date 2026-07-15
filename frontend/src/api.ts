import axios from 'axios'
import { useEffect, useState } from 'react'
import type { Campaign, Report, CreateCampaignPayload, UpdateCampaignPayload, AttackEvent, AttackAnalysisResult, BatchAnalysisStatus, TargetProfile, TestTargetResult } from './types'

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await axios.get('/api/campaigns')
  return res.data
}

export async function getCampaign(id: number): Promise<Campaign> {
  const res = await axios.get(`/api/campaigns/${id}`)
  return res.data
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await axios.post('/api/campaigns', payload)
  return res.data
}

export async function testTarget(profile: TargetProfile, message: string): Promise<TestTargetResult> {
  const res = await axios.post('/api/targets/test', { profile, message })
  return res.data
}

export async function startCampaign(id: number): Promise<void> {
  await axios.post(`/api/campaigns/${id}/start`)
}

export async function stopCampaign(id: number): Promise<void> {
  await axios.post(`/api/campaigns/${id}/stop`)
}

export async function restartCampaign(id: number): Promise<void> {
  await axios.post(`/api/campaigns/${id}/restart`)
}

export async function updateCampaign(id: number, payload: UpdateCampaignPayload): Promise<Campaign> {
  const res = await axios.patch(`/api/campaigns/${id}`, payload)
  return res.data
}

export async function deleteCampaign(id: number): Promise<void> {
  await axios.delete(`/api/campaigns/${id}`)
}

export async function getReport(id: number): Promise<Report> {
  const res = await axios.get(`/api/campaigns/${id}/report`)
  return res.data
}

export async function analyzeAttack(
  payload: string, response: string, attack_type: string
): Promise<AttackAnalysisResult> {
  const res = await axios.post('/api/attacks/analyze', { payload, response, attack_type })
  return res.data
}

export async function startBatchAnalysis(id: number): Promise<void> {
  await axios.post(`/api/campaigns/${id}/attacks/analyze-all`)
}

export async function getBatchAnalysisStatus(id: number): Promise<BatchAnalysisStatus> {
  const res = await axios.get(`/api/campaigns/${id}/attacks/analyze-all`)
  return res.data
}

export async function clearAttackLog(id: number): Promise<void> {
  await axios.delete(`/api/campaigns/${id}/attacks`)
}

export async function getCampaignAttacks(id: number): Promise<AttackEvent[]> {
  const res = await axios.get(`/api/campaigns/${id}/attacks`)
  return res.data
}

export function useCampaignEvents(campaignId: number, wsKey: number = 0): AttackEvent[] {
  const [events, setEvents] = useState<AttackEvent[]>([])

  useEffect(() => {
    setEvents([])
    const seen = new Set<string>()

    const addEvent = (e: AttackEvent) => {
      // Use timestamp as dedup key — unique per attack execution
      const key = `${e.timestamp}-${e.attack_type}-${e.round}-${e.attempt}`
      if (seen.has(key)) return
      seen.add(key)
      setEvents((prev) => {
        const idx = prev.findIndex((p) => p.timestamp > e.timestamp)
        return idx === -1 ? [...prev, e] : [...prev.slice(0, idx), e, ...prev.slice(idx)]
      })
    }

    // Load persisted results from DB (covers page refresh + server restart)
    getCampaignAttacks(campaignId).then((dbEvents) => dbEvents.forEach(addEvent))

    // Stream live events over WebSocket (replays all in-memory events for current run)
    const ws = new WebSocket(`ws://localhost:8000/ws/campaigns/${campaignId}`)
    ws.onmessage = (e: MessageEvent) => addEvent(JSON.parse(e.data) as AttackEvent)

    return () => ws.close()
  }, [campaignId, wsKey])

  return events
}
