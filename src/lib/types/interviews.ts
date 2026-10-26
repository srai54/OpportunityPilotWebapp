// ---------- Interviews (Candidate workspace): JobInterviewDtos.cs ----------
export type JobInterviewStatus = 'Scheduled' | 'Completed' | 'NoShow' | 'Cancelled'
export interface JobInterview {
  id: string
  opportunityId: string
  /** Job title of the opportunity. */
  title: string
  organization: string
  round: number
  /** UTC; null while the time is not agreed. */
  scheduledAt: string | null
  meetingUrl: string | null
  notes: string | null
  status: JobInterviewStatus
  version: number
  createdAt: string
  updatedAt: string
}
