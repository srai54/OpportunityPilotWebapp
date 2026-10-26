// Wire shapes of /api/v1/staffing/* (API: StaffingDtos.cs, StaffingPipelineDtos.cs).

export type DealStage =
  | 'New' | 'Qualified' | 'Shortlisted' | 'OutreachApproved' | 'Contacted' | 'Replied' | 'MeetingScheduled'
  | 'RequirementConfirmed' | 'CandidatesSubmitted' | 'Interviewing' | 'Offer' | 'Contracting' | 'Won'
  | 'Disqualified' | 'Lost' | 'OnHold'
export type DealSource = 'Manual' | 'Import' | 'LinkedInAssisted' | 'Upwork' | 'Freelancer' | 'Tender' | 'Referral' | 'PublicWeb'
export type AccountSource = 'Manual' | 'Import' | 'LinkedInAssisted' | 'Upwork' | 'Freelancer' | 'Tender' | 'Referral' | 'PublicWeb'

export type StaffingContact = {
  id: string; accountId: string; name: string; title: string | null; email: string | null; emailVerified: boolean
  linkedInUrl: string | null; evidence: string | null; version: number
  /** Optional: older API versions do not send it. */
  phone?: string | null
}
export type StaffingAccount = {
  id: string; name: string; domain: string | null; industry: string | null; location: string | null; source: AccountSource
  sourceReference: string | null; version: number; contacts: StaffingContact[]
}
export type DealActivity = { id: string; type: string; detail: string; occurredAt: string }
export type StaffingDeal = {
  id: string; accountId: string; contactId: string | null; title: string; source: DealSource; externalReference: string | null
  estimatedValue: number | null; currency: string | null; stage: DealStage; stageBeforeHold: DealStage | null
  nextAction: string | null; nextActionAt: string | null; version: number; activities: DealActivity[]; createdAt: string; updatedAt: string
  /** The client's job description (resume builder, 2026-10-26). */
  jobDescription?: string | null
}

export type CandidateField = 'Name' | 'Headline' | 'Skills' | 'Experience' | 'Location' | 'Availability' | 'Rate' | 'Email' | 'Phone' | 'Resume'
export type Consent = 'Pending' | 'Granted' | 'Withdrawn'
export type Availability = 'Unknown' | 'Immediate' | 'NoticePeriod' | 'NotAvailable'
export type RateUnit = 'Hour' | 'Day' | 'Month' | 'Year'

export type StaffingCandidate = {
  id: string; name: string; headline: string | null; email: string | null; phone: string | null; location: string | null
  skills: string | null; yearsExperience: number | null; availability: Availability; noticePeriodDays: number | null
  rateAmount: number | null; rateCurrency: string | null; rateUnit: RateUnit | null; hasResume: boolean; resumeVersion: number
  consent: Consent; consentRecordedAt: string | null; consentEvidence: string | null; shareableFields: CandidateField[]
  notifyByEmail: boolean; version: number; updatedAt: string
}

export type SubmissionState = 'Draft' | 'Approved' | 'Sent' | 'Withdrawn'
export type HandoffChannel = 'Email' | 'ClientPortal' | 'Manual'
export type Submission = {
  id: string; dealId: string; candidateId: string; candidateName: string; sharedFields: CandidateField[]
  snapshot: Record<string, string | null>; resumeVersion: number; candidateChangedSince: boolean; note: string | null
  state: SubmissionState; approvedAt: string | null; channel: HandoffChannel | null; receipt: string | null; sentAt: string | null
  version: number
}

export type InterviewState = 'Requested' | 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow'
export type InterviewMode = 'Video' | 'Phone' | 'Onsite'
export type NotificationStatus = 'NotNotified' | 'NotifiedManually' | 'NotifiedByEmail'
export type Interview = {
  id: string; submissionId: string; round: number; state: InterviewState; scheduledAt: string | null; timeZone: string | null
  durationMinutes: number | null; mode: InterviewMode | null; location: string | null; candidateNotes: string | null
  internalNotes: string | null; candidateNotification: NotificationStatus; version: number
}

export type FeedbackSource = 'Client' | 'Candidate' | 'Internal'
export type FeedbackDecision = 'None' | 'NextRound' | 'Selected' | 'Rejected' | 'OnHold'
export type Feedback = {
  id: string; submissionId: string; interviewId: string | null; source: FeedbackSource; decision: FeedbackDecision
  detail: string; sharedWithCandidate: boolean; recordedAt: string
}

export type OfferState = 'Draft' | 'Extended' | 'Accepted' | 'Declined' | 'Withdrawn'
export type ContractStatus = 'NotStarted' | 'Sent' | 'Signed' | 'Cancelled'
export type PlacementOutcome = 'Pending' | 'Placed' | 'FellThrough'
export type Offer = {
  id: string; submissionId: string; clientRate: number | null; candidatePay: number | null; currency: string | null
  unit: RateUnit | null; startDate: string | null; placementValue: number | null; state: OfferState; contract: ContractStatus
  contractVersion: string | null; signatureProvider: string | null; hasSignedDocument: boolean; outcome: PlacementOutcome
  notes: string | null; version: number
}

export type RateCardLine = { role: string; seniority: string | null; unit: RateUnit; rate: number }
export type RateCardStatus = 'Draft' | 'Active' | 'Retired'
export type RateCard = {
  id: string; name: string; currency: string; lines: RateCardLine[]; terms: string | null; validUntil: string | null
  cardVersion: number; status: RateCardStatus; version: number
}
export type ProposalState = 'Draft' | 'Approved' | 'Sent' | 'Accepted' | 'Rejected'
export type Proposal = {
  id: string; rateCardId: string; rateCardVersion: number; title: string; currency: string; lines: RateCardLine[]
  terms: string | null; body: string | null; validUntil: string | null; state: ProposalState; approvedAt: string | null
  receipt: string | null; sentAt: string | null; version: number
}

export type DealWork = { submissions: Submission[]; interviews: Interview[]; feedback: Feedback[]; offers: Offer[]; proposals: Proposal[] }

export type StaffingKpis = {
  openDeals: number; wonDeals: number; lostDeals: number
  stages: { stage: DealStage; current: number; reached: number }[]
  conversions: { from: string; to: string; fromCount: number; toCount: number; rate: number | null }[]
  sources: { source: DealSource; deals: number; won: number }[]
  openPipelineValue: { currency: string; amount: number }[]; placementValue: { currency: string; amount: number }[]
  averageDaysInStage: number | null; averageHoursToReply: number | null; overdueNextActions: number
  candidates: number; candidatesWithConsent: number; candidatesAvailable: number
  submissionsDraft: number; submissionsApproved: number; submissionsSent: number
  interviewsUpcoming: number; interviewsCompleted: number; interviewsNotNotified: number
  offersExtended: number; offersAccepted: number; contractsSigned: number; placements: number
  messagesAwaitingSend: number; repliesToClassify: number; meetingsUpcoming: number
}

/** GET /api/v1/staffing/interviews: one row of the sales interview tracker (StaffingInterviewBoardRowDto). */
export type InterviewBoardRow = {
  interview: Interview & { dealId: string; candidateNotifiedAt: string | null; updatedAt: string }
  candidateId: string; candidateName: string; candidateEmail: string | null; dealTitle: string; client: string | null
  progressLinkActive: boolean; progressShowsInterviews: boolean
}
