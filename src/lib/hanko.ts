import type { Hanko } from '@teamhanko/hanko-elements'
import { config } from './config'

let loading: Promise<Hanko> | null = null

/**
 * Registers Hanko's web components (`<hanko-auth>`, `<hanko-profile>`) once and returns the shared Hanko client.
 * The package is loaded on demand, so a deployment without VITE_HANKO_API_URL never downloads it.
 */
export function loadHanko(): Promise<Hanko> {
  const url = config.hankoApiUrl
  if (!url) return Promise.reject(new Error('Hanko sign-in is not switched on for this deployment.'))
  loading ??= import('@teamhanko/hanko-elements')
    .then(({ register }) =>
      register(url, {
        shadow: true,
        injectStyles: true,
        enablePasskeys: true,
        // Hanko's defaults, stated on purpose: the SDK keeps the session token in a first-party cookie, and
        // getSessionToken() reads it for the API's bearer header.
        sessionTokenLocation: 'cookie',
        cookieSameSite: 'lax',
      }),
    )
    .then(({ hanko }) => hanko)
    .catch((error: unknown) => {
      loading = null // let a later attempt (reload, retry) try again
      throw error instanceof Error ? error : new Error('Hanko sign-in could not load.')
    })
  return loading
}
