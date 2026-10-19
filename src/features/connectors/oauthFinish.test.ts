import { describe, expect, it } from 'vitest'
import { finishCall, nextLocation } from './oauthFinish'

describe('finishCall', () => {
  it('finishes a mailbox or a connector sign-in with the code and state', () => {
    expect(finishCall('?mailboxCode=c&mailboxState=s&provider=Google')).toEqual({ path: '/api/v1/mailboxes/Google/complete', body: { code: 'c', state: 's' } })
    expect(finishCall('?oauthCode=c&oauthState=s&service=Notion')).toEqual({ path: '/api/v1/integrations/oauth/complete/Notion', body: { code: 'c', state: 's' } })
  })
  it('ignores incomplete or odd addresses', () => {
    expect(finishCall('?mailbox=connected&provider=Google')).toBeNull()
    expect(finishCall('?oauthCode=c&service=Notion')).toBeNull()
    expect(finishCall('?oauthCode=c&oauthState=s&service=..%2Fadmin')).toBeNull()
  })
})

describe('nextLocation', () => {
  it('keeps only the query, on this page', () => {
    expect(nextLocation('https://app.example.test/settings?mailbox=connected&provider=Google', '/settings')).toBe('/settings?mailbox=connected&provider=Google')
    expect(nextLocation('https://evil.test/x?connected=Notion', '/connectors')).toBe('/connectors?connected=Notion')
  })
})
