// ---------- Research (docs/RESEARCH_CONTRACT.md in OpportunityPilotWebApi) ----------

/** Only Job and Customer are accepted by the API until M7. */
export type OpportunityMode = 'Customer' | 'Partner' | 'Investor' | 'Job' | 'Freelance'
/** Greenhouse, Lever and Adzuna are Job-campaign sources (CANDIDATE_PHASE1_CONTRACT.md); Customer campaigns reject them. */
export type SourceKind =
  | 'Paste'
  | 'Csv'
  | 'Url'
  | 'Feed'
  | 'Agent'
  | 'Greenhouse'
  | 'Lever'
  | 'Adzuna'
  | 'Ashby'
  | 'SmartRecruiters'
  | 'Recruitee'
  | 'Workable'
  | 'Workday'
  | 'JobSearch'
  | 'Remotive'
  | 'RemoteOk'
  | 'Arbeitnow'
  | 'Jobicy'
  | 'WeWorkRemotely'
  | 'TheMuse'
  | 'Instahyre'
export type SourceStatus = 'Pending' | 'Ok' | 'Failed' | 'Skipped'
export type ResearchJobState = 'Queued' | 'Running' | 'Completed' | 'CompletedWithGaps' | 'Failed' | 'Cancelled'
export type ResearchStage = 'Prepare' | 'Gather' | 'Extract' | 'Filter' | 'Score' | 'Complete'
export type FilterOutcome = 'Qualified' | 'NeedsVerification' | 'Excluded'
/** Suggested: research put it in the approval queue (score ≥ the campaign's autoSuggestMinScore). */
export type OpportunityStatus =
  | 'New'
  | 'Suggested'
  | 'Shortlisted'
  | 'Dismissed'
  | 'Applied'
  | 'Contacted'
  | 'Responded'
  | 'Interested'
  | 'Closed'
export type JobPlatform =
  | 'LinkedIn'
  | 'Naukri'
  | 'Instahyre'
  | 'Other'
  | 'Greenhouse'
  | 'Lever'
  | 'Adzuna'
  | 'Ashby'
  | 'SmartRecruiters'
  | 'Recruitee'
  | 'Workable'
  | 'Workday'
  | 'Indeed'
  | 'Seek'
  | 'Remotive'
  | 'RemoteOk'
  | 'Arbeitnow'
  | 'Jobicy'
  | 'WeWorkRemotely'
export type EventLevel = 'Info' | 'Warning' | 'Error'
export type WorkMode = 'Remote' | 'Hybrid' | 'Onsite'

/** Every list may be empty, which means "not applied". */
export interface CampaignCriteria {
  keywords: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  candidateYears: number | null
  locations: string[]
  workModes: WorkMode[]
  industries: string[]
  problems: string[]
  signals: string[]
  excludeKeywords: string[]
  excludeOrganizations: string[]
  /** Job only: exclude postings that read like a staffing agency. No agency signal never counts against a job. */
  excludeStaffingAgencies: boolean
  /** Job only: exclude postings older than this many days (1–365); null = off. Unknown dates are kept. */
  maxPostingAgeDays: number | null
}

export interface GoalPreview {
  source: 'Gemini' | 'Rules' | 'Template'
  fallbackReason: string | null
  mode: OpportunityMode | null
  criteria: CampaignCriteria
  ambiguities: string[]
  notes: string[]
}

export interface ResearchJobRef {
  id: string
  state: ResearchJobState
  stage: ResearchStage
  finishedAt: string | null
}

export interface CampaignSummary {
  id: string
  profileId: string
  mode: OpportunityMode
  name: string
  goal: string
  resultLimit: number
  /** 1–100: qualified Job opportunities scoring at least this become Suggested after a run. null = off. */
  autoSuggestMinScore: number | null
  /** 1–100: qualified Job opportunities scoring at least this are approved automatically. null = off. */
  autoApproveMinScore?: number | null
  version: number
  createdAt: string
  updatedAt: string
  sourceCount: number
  opportunityCount: number
  lastJob: ResearchJobRef | null
}

export interface Campaign extends CampaignSummary {
  criteria: CampaignCriteria
  /** Criterion key → weight. The server normalises them to sum 100. */
  weights: Record<string, number>
}

export interface Source {
  id: string
  campaignId: string
  kind: SourceKind
  label: string
  url: string | null
  platform: JobPlatform | null
  permissionNote: string | null
  status: SourceStatus
  lastFetchedAt: string | null
  safeError: string | null
  itemCount: number
  textLength: number
  createdAt: string
}

export interface ImportPreviewRow {
  row: number
  values: Record<string, string>
  errors: string[]
}

export interface ImportPreview {
  importId: string
  columns: string[]
  warnings: string[]
  /** The first 50 rows only. */
  rows: ImportPreviewRow[]
  validCount: number
  errorCount: number
}

export interface ResearchCounts {
  sources: number
  sourcesDone: number
  sourcesFailed: number
  fetched: number
  candidates: number
  qualified: number
  needsVerification: number
  excluded: number
}

export interface ResearchEvent {
  at: string
  stage: ResearchStage
  level: EventLevel
  message: string
}

export interface ResearchJob {
  id: string
  campaignId: string
  state: ResearchJobState
  stage: ResearchStage
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  safeError: string | null
  counts: ResearchCounts
  /** The exact inputs the run used (single job only). */
  inputs?: { campaignVersion: number; profileVersion: number; profile: unknown; criteria: Record<string, unknown> }
  /** Latest 100, newest first. Omitted from job lists. */
  events?: ResearchEvent[]
}

export interface OpportunitySummary {
  id: string
  campaignId: string
  mode: OpportunityMode
  title: string
  organization: string
  location: string | null
  url: string | null
  applyUrl: string | null
  platform: JobPlatform | null
  score: number
  coverage: number
  outcome: FilterOutcome
  outcomeReason: string | null
  status: OpportunityStatus
  gapsCount: number
  updatedAt: string
  /** When the job or lead was first found, so the list can say which came first. */
  foundAt: string
}

export interface OpportunityPage {
  total: number
  items: OpportunitySummary[]
}

/** 1 met, 0.5 partly, 0 not met, null unknown (contributes 0 but stays in the score). */
export type CriterionValue = 1 | 0.5 | 0 | null

export interface FitContribution {
  criterion: string
  label: string
  weight: number
  value: CriterionValue
  points: number
  reason: string
  evidenceIds: string[]
  /** The sentence (or structured-field note) that justified the verdict; null when Unknown. */
  excerpt?: string | null
}

export interface OpportunityFact {
  key: string
  label: string
  value: string
  evidenceId: string | null
  isInference: boolean
}

export interface Evidence {
  id: string
  sourceId: string
  sourceLabel: string
  url: string | null
  retrievedAt: string
  excerpt: string
  extractionMethod: string
}

export interface OpportunityActivity {
  kind: string
  occurredAt: string
  detail: string
}

export interface OpportunityDetail extends OpportunitySummary {
  description: string | null
  version: number
  breakdown: FitContribution[]
  facts: OpportunityFact[]
  gaps: string[]
  evidence: Evidence[]
  activities: OpportunityActivity[]
  /** The run that last scored this, with the exact campaign and profile versions it used. */
  scoredBy?: { researchJobId: string; campaignVersion: number; profileVersion: number; runAt: string } | null
}
