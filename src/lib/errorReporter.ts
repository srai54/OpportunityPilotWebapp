import { config } from './config'
import { createErrorGate, ignorable, pageOf, type ErrorReport } from '../features/feedback/feedbackModel'

/**
 * Browser error reporting (2026-10-26): uncaught errors, rejected promises and pages that failed to render are sent to the API
 * (`POST /api/v1/client-errors`), which counts repeats and keeps them 30 days for the admin. No personal data: the message, the page
 * without its query (a progress link's token is masked), the first lines of the stack, the browser and the build.
 */
const gate = createErrorGate()

export function reportError(error: unknown, source: string) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')
    const message = `${e.name}: ${e.message}`.slice(0, 500)
    const stack = e.stack ? e.stack.split('\n').slice(0, 12).join('\n') : null
    if (ignorable(message, stack) || !gate(message)) return
    const report: ErrorReport = {
      message, source, page: pageOf(window.location), stack, userAgent: navigator.userAgent.slice(0, 300), appVersion: __APP_COMMIT__,
    }
    void fetch(`${config.apiBaseUrl}/api/v1/client-errors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Reporting must never throw.
  }
}

let installed = false

/** Listens for uncaught errors and rejected promises once per page load. Off in development so local work stays quiet. */
export function installErrorReporter() {
  if (installed || import.meta.env.DEV || import.meta.env.MODE === 'test') return
  installed = true
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'window.error'))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'unhandledrejection'))
}
