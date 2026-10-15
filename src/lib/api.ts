import { config } from './config'

export class ApiError extends Error {
  status: number
  correlationId?: string
  fieldErrors?: Record<string, string[]>

  constructor(status: number, message: string, correlationId?: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.correlationId = correlationId
    this.fieldErrors = fieldErrors
  }
}

/** Thrown when the API cannot be reached at all, e.g. while the free Render host is waking up. */
export class ApiUnreachableError extends Error {}

/** The API stayed unreachable through the automatic wake-up retries (see lib/wakeRetry.ts). */
export class ApiStillUnreachableError extends ApiUnreachableError {}

type AuthHeaders = () => Promise<Record<string, string>>
let authHeaders: AuthHeaders = async () => ({})
type UnauthorizedHandler = (rejectedHeaders: Record<string, string>) => void
let onUnauthorized: UnauthorizedHandler = () => {}

export function configureApiAuth(headers: AuthHeaders, unauthorized: UnauthorizedHandler) {
  authHeaders = headers
  onUnauthorized = unauthorized
}

/** A late 401 must not clear a newer session that was established while the request was in flight. */
export function sameAuthIdentity(left: Record<string, string>, right: Record<string, string>): boolean {
  const identity = (headers: Record<string, string>) => headers.Authorization ?? headers['X-Dev-User'] ?? ''
  return identity(left) === identity(right)
}

interface ProblemDetails {
  title?: string
  detail?: string
  correlationId?: string
  errors?: Record<string, string[]>
}

/** Sends a request with the auth headers and turns failures into ApiError / ApiUnreachableError. */
async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  let requestAuthHeaders: Record<string, string>
  try {
    requestAuthHeaders = await authHeaders()
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...requestAuthHeaders,
        ...init.headers,
      },
    })
  } catch {
    throw new ApiUnreachableError('The API could not be reached.')
  }

  if (response.status === 401) {
    const currentAuthHeaders = await authHeaders()
    if (sameAuthIdentity(requestAuthHeaders, currentAuthHeaders)) onUnauthorized(requestAuthHeaders)
  }

  if (!response.ok) {
    let problem: ProblemDetails = {}
    try {
      problem = await response.json()
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      response.status,
      // A validation failure says why per field; those reasons are the message, never just "Validation failed".
      problem.detail ?? fieldReasons(problem.errors) ?? problem.title ?? fallbackMessage(response.status),
      problem.correlationId ?? response.headers.get('X-Correlation-ID') ?? undefined,
      problem.errors,
    )
  }
  return response
}

/** The field reasons of a validation failure as one sentence, or undefined when there are none. */
export function fieldReasons(errors: Record<string, string[]> | undefined): string | undefined {
  const reasons = Object.values(errors ?? {}).flat().filter(Boolean)
  return reasons.length ? reasons.join(' ') : undefined
}

/** Plain message when the API sent no problem details (the rate limiter sends an empty 429). */
export function fallbackMessage(status: number): string {
  if (status === 429) return 'Too many requests in a short time. Wait a minute, then try again.'
  return `Request failed (${status})`
}

/** Readiness failures that mean the API itself is unhealthy, not that this browser asked too often. */
export function isDegraded(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 500
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

/** For non-JSON responses such as CSV exports: the body as a blob plus the Content-Disposition header. */
export async function apiDownload(path: string, accept = '*/*'): Promise<{ blob: Blob; disposition: string | null }> {
  const response = await send(path, { headers: { Accept: accept } })
  return { blob: await response.blob(), disposition: response.headers.get('Content-Disposition') }
}

/** For binary answers such as audio: the body as a blob (same auth and error handling as api()). */
export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  return (await send(path, init)).blob()
}
