// Mirrors the API DTOs in OpportunityPilotWebApi (src/OpportunityPilot.Application).

export type ProfileType = 'Product' | 'Business' | 'Candidate' | 'Services'

export interface ProfileData {
  fields: Record<string, string>
  confirmations: Record<string, boolean>
}

export interface ProfileSummary {
  id: string
  type: ProfileType
  name: string
  version: number
  confirmedAt: string | null
  updatedAt: string
}

export interface Profile extends ProfileSummary {
  data: Partial<ProfileData>
  createdAt: string
}

export type CapabilityStatus =
  | 'Ready'
  | 'Configured'
  | 'NotConfigured'
  | 'Disabled'
  | 'ManualHandoff'
  | 'NotBuilt'
  | 'LocalAgent'

export interface Capability {
  key: string
  name: string
  category: string
  status: CapabilityStatus
  detail: string
  can: string[]
  cannot: string[]
}

/** Capability keys for the open job sources (CANDIDATE_PHASE1_CONTRACT.md §1), category "Sources". */
export type SourceCapabilityKey =
  | 'job-boards'
  | 'greenhouse'
  | 'lever'
  | 'adzuna'
  | 'ashby'
  | 'smartrecruiters'
  | 'recruitee'
  | 'workable'
  | 'workday'
  | 'remotive'
  | 'remoteok'
  | 'arbeitnow'
  | 'jobicy'
  | 'weworkremotely'

export interface Capabilities {
  environment: string
  databaseProvider: string
  aiMode: string
  /** Missing server configuration in plain words; empty when setup is complete. */
  setupRequired: string[]
  /** Demo mode: no sign-in provider, visitors continue as random guests. */
  guestSignIn: boolean
  /** Demo mode: no database, data is kept in memory until the server restarts. */
  temporaryStorage: boolean
  items: Capability[]
}

export interface Overview {
  profiles: number
  applied: number
  needsManual: number
  campaigns: number
  shortlisted: number
  /** Opportunities in status Suggested, waiting in the approval queue. */
  awaitingApproval: number
  draftsAwaitingReview: number
  followUpsDue: number
  /** Drafts approved and ready to send, drafts recorded as sent, and follow-ups still open (older servers omit these). */
  draftsApproved?: number
  draftsSent?: number
  followUpsOpen?: number
  /** Qualified opportunities nobody has decided on (the review queue when a campaign does not suggest, e.g. Sales). */
  qualifiedToReview?: number
}

export type ApplicationPlatform = 'LinkedIn' | 'Naukri' | 'Instahyre'

/** DryRun: the form was filled but not submitted. NeedsManual: a question the saved answers do not cover. */
export type ApplicationStatus = 'Applied' | 'DryRun' | 'NeedsManual' | 'Skipped' | 'Failed'

export interface ApplicationItem {
  id: string
  platform: ApplicationPlatform
  externalJobId: string
  jobUrl: string
  title: string
  company: string
  location: string | null
  status: ApplicationStatus
  detail: string | null
  occurredAt: string
  updatedAt: string
}

export interface ApplicationPage {
  total: number
  items: ApplicationItem[]
}

export interface ApplicationSummary {
  applied: number
  appliedLast7Days: number
  needsManual: number
  dryRun: number
  skipped: number
  failed: number
  lastActivityAt: string | null
}

export interface AgentKey {
  id: string
  name: string
  /** First characters of the key, enough to recognise it. The full key is never returned again. */
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

/** Returned once, on creation only. */
export interface CreatedAgentKey extends AgentKey {
  key: string
}

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

// ---------- Sales pipeline (OpportunityPilotWebApi/docs/SALES_CONTRACT.md) ----------

export type SalesProjectSource = 'Upwork' | 'Freelancer' | 'TenderFeed' | 'PublicUrl' | 'Manual'
export type SalesProjectState = 'New' | 'Shortlisted' | 'BidPrepared' | 'BidApproved' | 'BidPlaced' | 'ManualHandoff' | 'Dismissed'
export type SalesBidState = 'Draft' | 'Approved' | 'Placed' | 'Failed'

export interface SalesBid {
  id: string
  projectId: string
  amount: number
  currency: string
  deliveryDays: number
  proposal: string
  version: number
  state: SalesBidState
  approvedVersion: number | null
  approvedAt: string | null
  hasValidApproval: boolean
  createdAt: string
  updatedAt: string
}

export interface SalesProject {
  id: string
  source: SalesProjectSource
  externalId: string | null
  title: string
  buyer: string | null
  description: string | null
  url: string | null
  deadlineUtc: string | null
  evidenceJson: string
  state: SalesProjectState
  version: number
  bids: SalesBid[]
  createdAt: string
  updatedAt: string
}

export type UpworkOpportunityState = 'Saved' | 'Shortlisted' | 'Dismissed' | 'Promoted'
export type UpworkBudgetType = 'Unknown' | 'FixedPrice' | 'Hourly'
export type ConnectsStatus = 'Unknown' | 'Sufficient' | 'Insufficient'

export interface UpworkOpportunity {
  id: string
  providerJobId: string
  title: string
  url: string
  summary: string | null
  location: string | null
  budgetType: UpworkBudgetType
  budgetMin: number | null
  budgetMax: number | null
  currency: string | null
  experienceLevel: string | null
  connectsRequired: number | null
  availableConnectsAtReview: number | null
  connectsStatus: ConnectsStatus
  paymentVerified: boolean | null
  postedAt: string | null
  observedAt: string
  evidenceJson: string
  state: UpworkOpportunityState
  salesProjectId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

// ---------- Wellfound shared Candidate / Sales workspace ----------

export type WellfoundJobScope = 'CandidateDiscovery' | 'RecruiterOwned'
export type WellfoundJobState = 'New' | 'Saved' | 'Applied' | 'Interviewing' | 'Offered' | 'Rejected'
export type WellfoundApplicationState = 'New' | 'Reviewing' | 'Shortlisted' | 'Interviewing' | 'Offered' | 'Hired' | 'Rejected'

export interface WellfoundStatus {
  mode: string
  recruitConnected: boolean
  reachConnected: boolean
  recruitServer: string
  reachServer: string
  recruitReadScopes: string[]
  reachReadScopes: string[]
  detail: string
}

export interface WellfoundJob {
  id: string
  providerJobId: string
  scope: WellfoundJobScope
  title: string
  companyName: string
  location: string | null
  remoteType: string | null
  salaryMin: number | null
  salaryMax: number | null
  currency: string | null
  equityMin: number | null
  equityMax: number | null
  experienceLevel: string | null
  employmentType: string | null
  industry: string | null
  fundingStage: string | null
  employeeCount: string | null
  visaSponsorship: boolean | null
  postedAt: string | null
  applyUrl: string
  summary: string | null
  skills: string[]
  matchScore: number | null
  state: WellfoundJobState
  isDemo: boolean
  version: number
  updatedAt: string
}

export interface WellfoundApplication {
  id: string
  jobId: string
  jobTitle: string
  providerApplicationId: string
  candidateName: string
  fitScore: number | null
  state: WellfoundApplicationState
  isDemo: boolean
  version: number
  updatedAt: string
}

export interface WellfoundActivity {
  id: string
  kind: string
  detail: string
  providerConfirmed: boolean
  occurredAt: string
}

export interface WellfoundKpis {
  workspace: 'Candidate' | 'Sales'
  jobs: number
  saved: number
  applied: number
  interviewing: number
  offered: number
  applicants: number
  reviewing: number
  shortlisted: number
  rejected: number
  activities: number
  discoveryJobs: number
}

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
