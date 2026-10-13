/** How it works: five short steps, the same ones as the bar at the top of the app. */
export interface FlowStep {
  title: string
  /** One short line, in the words of each workspace. */
  candidate: string
  sales: string
  to: string
  action: string
  icon: string
}

export const FLOW_STEPS: FlowStep[] = [
  { title: 'Profile', icon: '◉', candidate: 'Tell it what you offer and your skills.', sales: 'Tell it what you sell and who it is for.', to: '/profiles/new', action: 'Open profiles' },
  { title: 'Find', icon: '⌕', candidate: 'Search every job site at once.', sales: 'Find companies that are hiring right now.', to: '/wellfound', action: 'Start a search' },
  { title: 'Review', icon: '✓', candidate: 'Each job gets a score and a reason. Approve the good ones.', sales: 'Each company gets a score and a reason. Approve the good ones.', to: '/opportunities', action: 'See matches' },
  { title: 'Reach out', icon: '✉', candidate: 'Apply, or send a short message you have approved.', sales: 'Send a short message you have approved.', to: '/outreach', action: 'Open messages' },
  { title: 'Follow up', icon: '↻', candidate: 'See what you sent and nudge in a few days.', sales: 'See what you sent and nudge in a few days.', to: '/follow-ups', action: 'See follow-ups' },
]

/** What stays true everywhere. Three short lines. */
export const ALWAYS_TRUE = [
  'You approve before anything is sent or applied.',
  'Unknown facts stay unknown and score zero.',
  'Every job links to its original posting.',
]
