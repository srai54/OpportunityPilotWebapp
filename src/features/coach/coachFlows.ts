import type { CoachFlow } from './coachModel'

/**
 * Guide-mode tips, three or four per screen (the pattern's limit). Each step points at an element with `data-coach`.
 * Wording is about what to do next, never about how the app works inside. `sales` overrides the words for the Sales workspace.
 */
export const COACH_FLOWS: CoachFlow[] = [
  {
    id: 'overview', label: 'Home',
    steps: [
      { target: 'journey', title: 'Your path, in five steps', body: 'A tick means done. The dark step is what to do now. Click any step to jump there. Guide (top right) turns these tips off.' },
      { target: 'start-card', title: 'Do this next', body: 'The highlighted step has one button. Press it — you never need to hunt through menus.' },
      { target: 'ws-toggle', title: 'Looking for a job, or for customers?', body: 'Candidate finds roles for you. Sales finds companies that are hiring, to sell to. Same five steps, different words.',
        sales: { body: 'Sales finds companies that are hiring, to sell to. Candidate finds roles for you. Same five steps, different words.' } },
      { target: 'advanced-switch', title: 'Want more?', body: 'Advanced adds the full menu, every filter, scoring detail and staffing tools. Leave it off until you need it.' },
    ],
  },
  {
    id: 'profile', label: 'Profile',
    steps: [
      { target: 'profile-intro', title: 'This takes a minute', body: 'Say what you offer. Everything after this — search, scoring, messages — uses it.', sales: { body: 'Say what you sell. Everything after this — search, scoring, messages — uses it.' } },
      { target: 'profile-fields', title: 'Only what a first search needs', body: 'Name it, say what you offer, add your skills. You can add detail later in Advanced.', sales: { body: 'Name it, say what you sell and who it is for. You can add detail later in Advanced.' } },
      { target: 'profile-save', title: 'Then straight to your first search', body: 'Saving takes you to a search that is already filled in. Nothing else to set up.', sales: { title: 'Then straight to finding companies' } },
    ],
  },
  {
    id: 'find', label: 'Find jobs',
    steps: [
      { target: 'find-search', title: '1. Type a role and a place', body: 'A role is enough. Press Search — real postings appear below, each linked to the original.', sales: { body: 'A role is enough. Press Search — companies that are hiring appear below, each linked to the original posting.' } },
      { target: 'find-filters', title: '2. Narrow it down', body: 'More filters has date, job type, experience, distance, country, pay shown only and more. Optional.' },
      { target: 'find-tabs', title: '3. Try another site', body: 'All sites reads Arbeitnow, Jobicy, We Work Remotely, Remotive, Remote OK and Himalayas for free, plus LinkedIn, Indeed and SEEK. Or pick one site. Trends shows which skills are asked for most.' },
      { target: 'find-campaign', title: '4. Keep what you find', body: 'Start a campaign from this search: every job is scored against your profile and the best are suggested for you to approve.', sales: { body: 'Start a campaign from this search: every company is scored against your profile and the best become leads for you to approve.' } },
    ],
  },
  {
    id: 'campaign', label: 'New campaign',
    steps: [
      { target: 'quick-role', title: '1. What and where', body: 'Say what to look for. Add a place if it matters.' },
      { target: 'quick-source', title: '2. Where to look', body: 'All free sites at once, one site, or one company\'s board. LinkedIn, Indeed and SEEK use your monthly search allowance.', sales: { body: 'Pick LinkedIn, Indeed or SEEK. Each hiring company found becomes a lead.' } },
      { target: 'quick-run', title: '3. Run it', body: 'It reads the jobs, scores them, and takes you straight to the ones to review. Nothing is applied for you.', sales: { body: 'It reads who is hiring, scores them, and takes you straight to the leads to review. Nothing is sent for you.' } },
    ],
  },
  {
    id: 'campaigns', label: 'Campaigns',
    steps: [
      { target: 'campaigns-new', title: 'Start another search', body: 'A campaign is one saved search. Pick a role, a place and the sites to read — free sites need no key.' },
      { target: 'campaigns-table', title: 'Open one to see what it found', body: 'Each row shows how many it found and when it last ran. Open the Next step link to review the results.', sales: { body: 'Each row shows how many companies it found and when it last ran. Open the Next step link to review the leads.' } },
    ],
  },
  {
    id: 'run', label: 'Search running',
    steps: [
      { target: 'run-status', title: 'Reading your sources', body: 'This takes under a minute. You will land on the matches to review by yourself — no need to wait on this page or click anything.' },
    ],
  },
  {
    id: 'opps', label: 'Review',
    steps: [
      { target: 'opps-tabs', title: '1. Two views', body: '"Waiting for approval" holds the best matches for a quick yes or no. "All" is everything found.', sales: { body: '"Waiting for approval" holds the best leads for a quick yes or no. "All" is every company found.' } },
      { target: 'opps-match', title: '2. The match score', body: 'A ranking out of 100 against your profile — not a chance of success. Higher is a closer fit.' },
      { target: 'opps-action', title: '3. Approve, or open one', body: 'Approve a job you like, then open it to apply or reach out. Skip the rest.', sales: { body: 'Approve a lead you like, then open it to reach out. Skip the rest.' } },
    ],
  },
  {
    id: 'opp', label: 'Opportunity',
    steps: [
      { target: 'opp-approve', title: '1. Approve & apply', body: 'Approves the job and opens its application page. Apply there, then come back and click "I applied".', sales: { title: '1. Approve this lead', body: 'Approves the company and opens its page. Then reach out below.' } },
      { target: 'opp-reach', title: '2. Reach out', body: 'One click drafts a LinkedIn note or an email and opens it in Outreach for you to edit and send.' },
      { target: 'opp-advanced', title: '3. Want the proof?', body: 'Advanced shows how the score was built, the facts found, and the evidence behind them.' },
    ],
  },
  {
    id: 'outreach', label: 'Reach out',
    steps: [
      { target: 'out-editor', title: '1. Edit the message', body: 'Replace anything in [square brackets] with your own words — a draft with a placeholder cannot be approved.' },
      { target: 'out-mailapp', title: '2. Pick your mail app', body: 'Using Outlook in Edge or as an installed app? Choose it here and the message opens there, ready to send.' },
      { target: 'out-send', title: '3. Approve & send', body: 'Approves this exact version, then opens your mail app or LinkedIn. You press Send there.' },
      { target: 'out-receipt', title: '4. Paste a receipt', body: 'After sending, paste the sent item\'s subject or time. It is then marked sent and a follow-up reminder is set for you automatically.' },
    ],
  },
  {
    id: 'followups', label: 'Follow up',
    steps: [
      { target: 'follow-list', title: 'Reminders, ready for you', body: 'A reminder is added when you record a send. Open the job to message again, and tick Done when it is handled.' },
      { target: 'follow-suppress', title: 'Someone asked you to stop?', body: 'Add them here. Messages to them can no longer be approved.' },
    ],
  },
  {
    id: 'insights', label: 'Insights',
    steps: [
      { target: 'insights-range', title: '1. Pick a time range', body: 'Everything on this page follows it: 7, 14, 30 or 90 days, always compared with the same number of days before.' },
      { target: 'insights-trend', title: '2. Read the trend', body: 'Click a name above the chart to hide or show a line. Hover or use the arrow keys to read one day. The numbers are also in a table below.' },
      { target: 'insights-progress', title: '3. Set a weekly goal', body: 'Your path shows how far you are. Set a goal for the week and the bar fills as you apply or send.', sales: { body: 'Your path shows how far you are. Set a goal for messages sent this week and the bar fills as you send.' } },
    ],
  },
]

export const COACH_FLOW_IDS = COACH_FLOWS.map((f) => f.id)
export const flowById = (id: string | null): CoachFlow | undefined => COACH_FLOWS.find((f) => f.id === id)
