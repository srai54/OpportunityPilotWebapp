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
