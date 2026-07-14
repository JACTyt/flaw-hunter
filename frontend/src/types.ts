export type AttackType =
  | 'prompt_injection'
  | 'goal_hijacking'
  | 'tool_misuse'
  | 'data_exfiltration'

export type CampaignStatus = 'pending' | 'running' | 'completed' | 'stopped' | 'failed'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Campaign {
  id: number
  name: string
  target_url: string
  attack_types: AttackType[]
  status: CampaignStatus
  max_rounds: number
  max_retries: number
  created_at: string
  completed_at: string | null
}

export interface AttackEvent {
  attack_type: AttackType
  round: number
  attempt: number
  payload: string
  response: string
  success: boolean
  evidence: string
  severity: Severity
  confidence: number
  timestamp: string
  error?: boolean
}

export interface Vulnerability {
  type: string
  severity: Severity
  evidence: string
  payload: string
  recommendation: string
}

export interface ReportSummary {
  total_attacks: number
  successful: number
  exploit_success_rate: number
  coverage: number
  severity_distribution: Partial<Record<Severity, number>>
}

export interface BatchAnalysisResult {
  attack_type: string
  round: number
  attempt: number
  success?: boolean
  severity?: string
  evidence?: string
  error?: string
}

export interface BatchAnalysisStatus {
  status: 'idle' | 'running' | 'done'
  total: number
  completed: number
  results: BatchAnalysisResult[]
}

export interface AttackAnalysisResult {
  success: boolean
  evidence: string
  confidence: number
  severity: Severity
  failure_reason: string
  vulnerability_type: string
}

export interface LLMAnalysis {
  breached: boolean
  overall_risk: Severity
  opinion: string
  key_findings: string[]
  recommendations: string[]
}

export interface Report {
  campaign_id: number
  target_url: string
  summary: ReportSummary
  vulnerabilities: Vulnerability[]
  llm_analysis?: LLMAnalysis
}

export interface UpdateCampaignPayload {
  name?: string
  target_url?: string
  attack_types?: AttackType[]
  max_rounds?: number
  max_retries?: number
}

export interface CreateCampaignPayload {
  name: string
  target_url: string
  attack_types: AttackType[]
  max_rounds: number
  max_retries: number
}
