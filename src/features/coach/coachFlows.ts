import type { CoachFlow } from './coachModel'

/**
 * First-time tips, three or four per screen (the pattern's limit). Each step points at an element with `data-coach`.
 * Wording is about what to do next, never about how the app works inside.
 */
export const COACH_FLOWS: CoachFlow[] = [
  {
    id: 'overview', label: 'Overview',
    steps: [
      { target: 'nav-find', title: 'Start here', body: 'Find jobs (or companies) searches Wellfound, Indeed, LinkedIn and SEEK, and shows what is in demand on the Trends tab.' },
      { target: 'nav-opps', title: 'Your matches wait here', body: 'Everything you find is scored. Approve the good ones, skip the rest — nothing is applied or sent without you.' },
      { target: 'nav-outreach', title: 'Then reach out', body: 'Messages you draft land here. Edit one, approve it, send it yourself, and paste a receipt.' },
    ],
  },
  {
    id: 'find', label: 'Find jobs',
    steps: [
      { target: 'find-search', title: '1. Type a role and a place', body: 'A role is enough. Press Search — real postings appear below, each linked to the original.' },
      { target: 'find-filters', title: '2. Narrow it down', body: 'More filters has date, job type, experience, distance, country, pay shown only and more. Optional.' },
      { target: 'find-tabs', title: '3. Try another site', body: 'Switch between Wellfound, Indeed, LinkedIn and SEEK. The Trends tab shows which skills are asked for most.' },
      { target: 'find-campaign', title: '4. Keep track', body: 'Start a campaign from this search to score every job against your profile and get the best suggested for approval.' },
    ],
  },
  {
    id: 'campaign', label: 'New campaign',
    steps: [
      { target: 'quick-role', title: '1. What and where', body: 'Say what to look for. Add a place if it matters.' },
      { target: 'quick-source', title: '2. Where to look', body: 'Pick a job site, or one company\'s board.' },
      { target: 'quick-run', title: '3. Run it', body: 'It reads the jobs, scores them, and takes you to the results. Nothing is applied for you.' },
    ],
  },
  {
    id: 'opps', label: 'Opportunities',
    steps: [
      { target: 'opps-tabs', title: '1. Two views', body: '"All" is everything found. "Waiting for approval" holds the best matches for a quick yes or no.' },
      { target: 'opps-match', title: '2. The match score', body: 'A ranking out of 100 against your profile — not a chance of success. Higher is a closer fit.' },
      { target: 'opps-action', title: '3. One action per row', body: 'Approve a job you like, or open it for details and one-click apply.' },
    ],
  },
  {
    id: 'opp', label: 'Opportunity',
    steps: [
      { target: 'opp-approve', title: '1. Approve & apply', body: 'Approves the job and opens its application page. Apply there, then come back and click "I applied".' },
      { target: 'opp-reach', title: '2. Reach out', body: 'One click drafts a LinkedIn note or an email and opens it in Outreach for you to edit and send.' },
      { target: 'opp-advanced', title: '3. Want the proof?', body: 'Advanced shows how the score was built, the facts found, and the evidence behind them.' },
    ],
  },
  {
    id: 'outreach', label: 'Outreach',
    steps: [
      { target: 'out-editor', title: '1. Edit the message', body: 'Replace anything in [square brackets] with your own words — a draft with a placeholder cannot be approved.' },
      { target: 'out-send', title: '2. Approve & send', body: 'Approves this exact version, then opens your mail app or LinkedIn. You press Send there.' },
      { target: 'out-receipt', title: '3. Paste a receipt', body: 'After sending, paste the sent item\'s subject or time here. Only then is it marked sent.' },
    ],
  },
]

export const COACH_FLOW_IDS = COACH_FLOWS.map((f) => f.id)
export const flowById = (id: string | null): CoachFlow | undefined => COACH_FLOWS.find((f) => f.id === id)
