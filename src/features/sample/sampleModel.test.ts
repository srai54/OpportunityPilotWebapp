import { describe, expect, it } from 'vitest'
import { countLabel, pendingResearchJob, samplePath, sampleNotDeployed, sampleSummary, stillRunning } from './sampleModel'

describe('countLabel', () => {
  it('turns keys into words and singularises a count of 1', () => {
    expect(countLabel('candidates', 3)).toBe('candidates')
    expect(countLabel('candidates', 1)).toBe('candidate')
    expect(countLabel('staffingDeals', 2)).toBe('staffing deals')
    expect(countLabel('interviewCount', 1)).toBe('interview')
    expect(countLabel('address', 1)).toBe('address')
  })
})

describe('sampleSummary', () => {
  it('lists the counts that were added', () => {
    expect(sampleSummary({ added: { candidates: 5, deals: 2, interviews: 1, contacts: 0 } })).toBe('Added 5 candidates, 2 deals, 1 interview.')
    expect(sampleSummary({ candidates: 1284 })).toBe('Added 1,284 candidates.')
  })
  it('falls back to the message, then to a plain line', () => {
    expect(sampleSummary({ message: 'Sample data is already loaded.' })).toBe('Sample data is already loaded.')
    expect(sampleSummary(null)).toBe('Sample data added.')
    expect(sampleSummary({ version: 3 })).toBe('Sample data added.')
  })
})

describe('sampleNotDeployed', () => {
  it('treats a missing endpoint as not deployed yet', () => {
    expect(sampleNotDeployed(404)).toBe(true)
    expect(sampleNotDeployed(405)).toBe(true)
    expect(sampleNotDeployed(500)).toBe(false)
    expect(sampleNotDeployed(undefined)).toBe(false)
  })
})

describe('sample data follow-up', () => {
  it('reads the API answer: counts, the run to wait for, and the path per workspace', () => {
    const r = { salesCreated: true, accounts: 2, contacts: 3, candidates: 4, deals: 2, submissions: 1, staffingInterviews: 2, progressLinks: 1, candidateCreated: true, profiles: 1, campaigns: 1, sources: 2, researchJobId: 'j1', jobInterviews: 0, jobInterviewsPending: true }
    expect(sampleSummary(r)).toBe('Added 2 accounts, 3 contacts, 4 candidates, 2 deals, 1 submission, 2 staffing interviews, 1 progress link, 1 profile, 1 campaign, 2 sources.')
    expect(pendingResearchJob(r)).toBe('j1')
    expect(pendingResearchJob({ ...r, jobInterviewsPending: false })).toBeNull()
    expect(pendingResearchJob({ jobInterviewsPending: true, researchJobId: null })).toBeNull()
    expect(samplePath('Sales')).toBe('/api/v1/sample-data?workspace=Sales')
    expect(samplePath()).toBe('/api/v1/sample-data')
    expect(stillRunning('Running')).toBe(true)
    expect(stillRunning('Completed')).toBe(false)
  })
})
