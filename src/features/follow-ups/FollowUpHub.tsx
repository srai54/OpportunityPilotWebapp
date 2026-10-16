import { useSearchParams } from 'react-router-dom'
import { InboxPage } from '../inbox/InboxPage'
import { FollowUpsPage } from './FollowUpsPage'

const TABS = [
  { key: 'replies', label: 'Replies' },
  { key: 'reminders', label: 'Reminders' },
] as const
type Tab = (typeof TABS)[number]['key']

/**
 * Follow up (step 5): replies that came in and the reminders you set, as two tabs of one screen instead of two menu items (Inbox and
 * Follow-ups). Each tab is the original page unchanged; /inbox opens the Replies tab.
 */
export function FollowUpHub() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'reminders' ? 'reminders' : 'replies'
  return (
    <div className="stack-2">
      <div className="page page-wide followup-tabs" role="tablist" aria-label="Follow up">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`fu-tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`fu-panel-${t.key}`}
            className={`tab ${tab === t.key ? 'tab-active' : ''}`} onClick={() => setParams((p) => { p.set('tab', t.key); return p }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`fu-panel-${tab}`} aria-labelledby={`fu-tab-${tab}`}>
        {tab === 'replies' ? <InboxPage /> : <FollowUpsPage />}
      </div>
    </div>
  )
}
