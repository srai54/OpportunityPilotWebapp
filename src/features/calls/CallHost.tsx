import { useEffect, useRef, useState } from 'react'
import { clearPendingCall, readPendingCall, shouldAskAboutCall, type PendingCall } from './callModel'
import { CallDoneSheet } from './CallDoneSheet'
import { dueReminders, msToNextReminder, readReminders } from './reminderModel'
import { ScheduleInterviewDialog, type ScheduleTarget } from './ScheduleInterviewDialog'

/**
 * Mounted once in the shell. Opens "After the call" when the page becomes visible again after a Call tap, and shows a browser
 * notification 1 hour before an interview the person asked to be reminded about (only if they allowed notifications).
 */
export function CallHost() {
  const [call, setCall] = useState<PendingCall | null>(null)
  const [schedule, setSchedule] = useState<ScheduleTarget | null>(null)

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      const pending = readPendingCall()
      if (!pending) return
      if (shouldAskAboutCall(pending)) { clearPendingCall(); setCall(pending) }
      else if (Date.now() - new Date(pending.at).getTime() > 1500) clearPendingCall()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [])

  // Reminders: one timer to the next "1 hour before" moment; each reminder is shown once per page load.
  const shown = useRef(new Set<string>())
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const now = new Date()
    const list = readReminders()
    if (Notification.permission === 'granted') {
      for (const r of dueReminders(list, now, shown.current)) {
        shown.current.add(r.key)
        try { new Notification('Interview in under an hour', { body: r.title, tag: r.key }) } catch { /* some phones only allow it from a service worker */ }
      }
    }
    const wait = msToNextReminder(list, now, shown.current)
    // Also re-read every 10 minutes, so reminders added in this tab are picked up.
    const timer = window.setTimeout(() => setTick((t) => t + 1), Math.min(wait ?? 600_000, 600_000))
    return () => window.clearTimeout(timer)
  }, [tick])

  return <>
    {call && <CallDoneSheet call={call} onClose={() => setCall(null)} onSchedule={(t) => { setCall(null); setSchedule(t) }} />}
    {schedule && <ScheduleInterviewDialog target={schedule} onClose={() => setSchedule(null)} onDone={() => setSchedule(null)} />}
  </>
}
