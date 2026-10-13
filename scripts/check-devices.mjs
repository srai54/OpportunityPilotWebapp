// Device and accessibility check: opens the main screens on phone, tablet and laptop profiles, light and dark, and fails on
// sideways scroll or axe violations. Run it against a local API in demo mode (guest sign-in) and the dev server:
//   API:  ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5080 ConnectionStrings__Main= Auth__SupabaseUrl= dotnet run --project src/OpportunityPilot.Api --no-launch-profile
//   Web:  npx vite --config scratch-local.config.ts   (proxies /api to :5080; see CLAUDE.md)
//   Then: npm run check:devices            (add -- --quick for 3 devices, -- --shots out/ to save screenshots)
// WebKit is the real Safari engine (iPhone, iPad); install it once with: npx playwright install webkit
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const API = opt('--api', process.env.API_URL ?? 'http://localhost:5080')
const APP = opt('--app', process.env.APP_URL ?? 'http://localhost:5198')
const SHOTS = opt('--shots', null)
const QUICK = args.includes('--quick')

let pw, AxeBuilder
try {
  pw = await import('playwright')
  AxeBuilder = (await import('@axe-core/playwright')).default
} catch {
  console.error('Playwright is not installed. Run: npm install   (it is a dev dependency), then: npx playwright install webkit')
  process.exit(2)
}
const { chromium, webkit, devices } = pw
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

// --- seed: one Sales workspace with three leads, one approved email draft and one search, through the public API ---
const guest = await (await fetch(`${API}/api/v1/auth/guest`, { method: 'POST' })).json().catch(() => null)
if (!guest?.token) { console.error(`Could not sign in as a guest at ${API}. Is the API running in demo mode?`); process.exit(2) }
const H = { Authorization: `Bearer ${guest.token}`, 'Content-Type': 'application/json' }
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  const t = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : {}
}
const profile = await call('POST', '/api/v1/profiles', { type: 'Product', name: 'Payroll software', data: { fields: { offer: 'Payroll for SMEs' }, confirmations: {} }, confirmed: true })
const campaign = await call('POST', '/api/v1/campaigns', { profileId: profile.id, mode: 'Customer', name: 'SME payroll leads', goal: 'Find buyers', criteria: { keywords: ['payroll'], locations: ['London'] } })
for (const c of ['Northwind Traders', 'Contoso Logistics', 'Fabrikam Retail'])
  await call('POST', `/api/v1/campaigns/${campaign.id}/sources`, { kind: 'Paste', text: `${c}\nWebsite: https://${c.split(' ')[0].toLowerCase()}.example\nLocation: London\n${c} needs payroll software.` })
await call('POST', `/api/v1/campaigns/${campaign.id}/research`)
let opps = []
for (let i = 0; i < 20 && opps.length < 3; i++) { await new Promise((r) => setTimeout(r, 700)); opps = (await call('GET', `/api/v1/campaigns/${campaign.id}/opportunities`)).items }
if (opps.length === 0) { console.error('The seeded research run produced no leads; is the research worker on?'); process.exit(2) }
await call('PATCH', `/api/v1/opportunities/${opps[0].id}/status`, { status: 'Shortlisted' })
let draft = await call('POST', `/api/v1/opportunities/${opps[0].id}/drafts`, { channel: 'Email', recipient: 'ops@example.test' })
draft = await call('PUT', `/api/v1/drafts/${draft.id}`, { recipient: 'ops@example.test', subject: 'Hello', body: 'Hello team, we help with payroll. Regards, Asha', expectedVersion: draft.version })
await call('POST', `/api/v1/drafts/${draft.id}/approve`, { version: draft.version })

const MATRIX = [
  ['iPhone 13 (WebKit)', webkit, devices['iPhone 13']],
  ['Pixel 7 (Chromium)', chromium, devices['Pixel 7']],
  ['Laptop 1280 (Edge)', chromium, { viewport: { width: 1280, height: 800 } }],
  ...(QUICK ? [] : [
    ['iPhone 14 Pro Max (WebKit)', webkit, devices['iPhone 14 Pro Max']],
    ['iPad Mini (WebKit)', webkit, devices['iPad Mini']],
    ['Galaxy S9+ (Chromium)', chromium, devices['Galaxy S9+']],
  ]),
]
const SIGNED_OUT = ['/signin', '/signup']
const SIGNED_IN = ['/', '/opportunities', `/opportunities/${opps[0].id}`, '/profiles', '/campaigns', '/campaigns/new', '/outreach', '/follow-ups', '/settings', '/insights', '/connectors']

let problems = 0
for (const [label, type, descriptor] of MATRIX) {
  for (const scheme of ['light', 'dark']) {
    let browser
    try { browser = await type.launch(type === chromium ? { channel: 'msedge' } : {}) } catch (e) { console.error(`${label}: cannot launch (${e.message.split('\n')[0]})`); problems++; continue }
    const context = await browser.newContext({ ...descriptor, colorScheme: scheme })
    const page = await context.newPage()
    const lines = []
    let limited = false
    page.on('response', (r) => { if (r.status() === 429) limited = true })
    const check = async (path) => {
      // The API allows 120 requests a minute per person; a long run can hit it. Wait it out and look again rather than report a false failure.
      for (let attempt = 0; attempt < 3; attempt++) {
        limited = false
        await page.goto(APP + path)
        await page.waitForTimeout(1500)
        if (!limited) break
        await page.waitForTimeout(20000)
      }
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      const axe = await new AxeBuilder({ page }).analyze()
      const bad = sideways || axe.violations.length > 0
      if (bad) problems++
      lines.push(`${bad ? 'FAIL' : 'ok  '} ${path.replace(opps[0].id, ':id')}${sideways ? '  sideways scroll' : ''}${axe.violations.length ? '  axe: ' + axe.violations.map((v) => `${v.id}×${v.nodes.length} (${v.nodes[0].html.replace(/\s+/g, ' ').slice(0, 90)})`).join(', ') : ''}`)
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label.split(' ')[0]}-${scheme}-${path.replace(/\W+/g, '_') || 'home'}.png`, fullPage: true })
    }
    for (const p of SIGNED_OUT) await check(p)
    await context.addInitScript((g) => localStorage.setItem('op.guestToken', JSON.stringify(g)), guest)
    await page.goto(APP + '/opportunities')
    await page.waitForTimeout(1500)
    // First visit shows onboarding: pick Sales and skip so the signed-in screens render.
    if (await page.getByRole('button', { name: 'Skip for now' }).isVisible().catch(() => false)) {
      await page.getByText('I am looking for customers').click()
      await page.getByRole('button', { name: 'Skip for now' }).click()
      await page.waitForTimeout(1200)
    }
    for (const p of SIGNED_IN) await check(p)
    console.log(`\n${label} · ${scheme}\n  ${lines.join('\n  ')}`)
    await browser.close()
  }
}
console.log(`\n${problems === 0 ? 'PASS' : 'FAIL'}: ${problems} problem(s) across ${MATRIX.length} devices × 2 themes × ${SIGNED_OUT.length + SIGNED_IN.length} screens`)
process.exit(problems === 0 ? 0 : 1)
