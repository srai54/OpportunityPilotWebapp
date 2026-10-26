// ---------- Outreach drafts (OpportunityPilotWebApi/docs/M4_M5_CONTRACT.md) ----------

export type DraftChannel = 'Email' | 'CoverNote' | 'LinkedInMessage' | 'ContactForm'
export type DraftState = 'Draft' | 'Approved' | 'Sent'
export type DraftSource = 'Gemini' | 'Template'

export interface DraftClaim {
  text: string
  basis: 'Profile' | 'Evidence'
  evidenceId: string | null
}

export interface OutreachDraft {
  id: string
  opportunityId: string
  channel: DraftChannel
  recipient: string | null
  recipientVerified: boolean
  recipientSource: 'Evidence' | 'UserEntered'
  recipientEvidenceId: string | null
  subject: string | null
  body: string
  version: number
  state: DraftState
  approvedVersion: number | null
  approvedAt: string | null
  source: DraftSource
  fallbackReason: string | null
  claims: DraftClaim[]
  sendReady: boolean
  sendBlockers: string[]
  createdAt: string
  updatedAt: string
}

export interface DraftListItem {
  id: string
  opportunityId: string
  campaignId: string
  campaignName: string
  opportunityTitle: string
  organization: string
  channel: DraftChannel
  recipient: string | null
  recipientVerified: boolean
  recipientSource: 'Evidence' | 'UserEntered'
  recipientEvidenceId: string | null
  state: DraftState
  version: number
  updatedAt: string
}

export interface DraftPage { total: number; items: DraftListItem[] }
export interface BatchApproveDraftResult { id: string; approved: boolean; reason: string | null; draft: OutreachDraft | null }
export type NextActionKind = 'FollowUp' | 'CheckStatus' | 'Call' | 'Other'
export type NextActionState = 'Open' | 'Done' | 'Cancelled'
export interface NextAction {
  id: string
  opportunityId: string
  opportunityTitle: string
  organization: string
  kind: NextActionKind
  note: string
  dueAt: string
  timeZone: string
  state: NextActionState
  overdue: boolean
  createdAt: string
  completedAt: string | null
}
export interface Suppression { id: string; recipient: string; reason: string; createdAt: string }
