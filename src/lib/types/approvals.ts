import type { JobPlatform } from './research'

// ---------- Approval queue (docs/CANDIDATE_PHASE1_CONTRACT.md §2 in OpportunityPilotWebApi) ----------

/** Agent: the local agent applies (LinkedIn / Naukri). You: the user opens applyUrl and applies. */
export type AppliesVia = 'Agent' | 'You'

export interface ApprovalItem {
  opportunityId: string
  campaignId: string
  campaignName: string
  title: string
  organization: string
  location: string | null
  platform: JobPlatform | null
  applyUrl: string | null
  score: number
  coverage: number
  outcomeReason: string | null
  appliesVia: AppliesVia
}

/** GET /api/v1/approvals — Suggested opportunities, highest score first. */
export interface ApprovalPage {
  total: number
  items: ApprovalItem[]
}

/** POST /api/v1/approvals/decide — at most 200 ids in total, no id in both lists. */
export interface DecideRequest {
  approve: string[]
  reject: string[]
}

/** Ids not owned or no longer Suggested are counted as skipped, not errors. */
export interface DecideResult {
  approved: number
  rejected: number
  skipped: number
}

/** GET /api/v1/analytics/overview?workspace=Candidate|Sales&days=30 (OpportunityPilotWebApi/docs/ANALYTICS_CONTRACT.md). */
export type AnalyticsWorkspace = 'Candidate' | 'Sales'

export interface AnalyticsOverview {
  workspace: AnalyticsWorkspace
  days: number
  generatedAt: string
  campaignCount: number
  kpis: {
    found: number
    qualified: number
    qualifyRate: number | null
    awaitingApproval: number
    shortlisted: number
    shortlistedNotApplied: number
    applied: number | null
    appliedByAgent: number | null
    appliedByYou: number | null
    contacted: number | null
    responded: number | null
    respondedRate: number | null
    agentNeedsYou: number
  }
  funnel: { key: string; label: string; count: number | null; note: string }[]
  fitHistogram: { bands: { from: number; to: number; count: number }[]; threshold: number | null; aboveThreshold: number | null }
  unknownCriteria: { criterion: string; label: string; unknownCount: number }[]
  sources: {
    sourceId: string
    campaignId: string
    label: string
    kind: string
    platform: string | null
    read: number
    qualified: number
    rate: number | null
    lastFetchedAt: string | null
    failing: boolean
  }[]
  applicationsPerDay: { date: string; applied: number; replies: number }[] | null
  attention: { kind: 'Approvals' | 'ShortlistedNotApplied' | 'AgentNeedsYou' | 'SourceFailing' | 'FollowUpsOverdue'; count: number; detail: string }[]
  /** Sales only: drafts, bids and follow-ups counted now from stored records. */
  outreach?: { draftsAwaitingReview: number; draftsApproved: number; bidsPlaced: number; bidsFailed: number; followUpsDue: number; followUpsOverdue: number; replyRate: number | null } | null
  activeResearch: {
    jobId: string
    campaignId: string
    campaignName: string
    state: string
    stage: string
    counts: { candidates: number; sources: number; sourcesDone: number }
  } | null
  qualifiedByIndustry: { industry: string; count: number }[] | null
  signalsFound: { signal: string; count: number }[] | null
}

/** GET/POST /api/v1/demo/sales — owner-scoped, fictional replayable Sales workspace. */
export interface SalesDemoStatus {
  exists: boolean
  researchDone: boolean
  campaigns: number
  opportunities: number
  shortlisted: number
  drafts: number
  staffingDeals: number
  jobIds: string[]
}

/** GET /api/v1/analytics/trend — daily counts for the last N days plus the totals of the window before. */
export interface TrendPoint { date: string; found: number; qualified: number; approved: number; reached: number; replied: number; sent: number }
export type TrendTotals = Omit<TrendPoint, 'date'>
export interface AnalyticsTrend {
  workspace: AnalyticsWorkspace
  days: number
  generatedAt: string
  points: TrendPoint[]
  current: TrendTotals
  previous: TrendTotals
}

/** One recorded action of the signed-in person (GET /api/v1/analytics/activity). */
export interface ActivityFeedItem {
  at: string
  kind: string
  detail: string
  /** null for things that belong to no job or lead (a search, a saved profile). */
  opportunityId: string | null
  title: string
  organization: string
}
