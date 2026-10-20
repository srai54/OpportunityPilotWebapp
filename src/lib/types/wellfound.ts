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
