// Redesign v4 — shell and layout check for the REAL app (not the prototype).
// Move to scripts/check-shell.mjs in Phase 0 and add  "check:shell": "node scripts/check-shell.mjs"  to package.json.
//
// Run it the same way as scripts/check-devices.mjs (API in demo mode + dev server; see that file's header), then:
//   npm run check:shell                     (APP_URL defaults to http://localhost:5198, API_URL to http://localhost:5080)
//   npm run check:shell -- --app http://localhost:5198
//
// For every route × 1280 / 1024 / 375 × light / dark × Simple / Advanced it fails on:
//   - the top bar wrapping or growing past 52px            (redesign rule: one line, priority-hide instead of wrap)
//   - the hamburger missing                                 (data-testid="app-burger")
//   - sideways scroll
//   - axe WCAG 2.1 AA violations                           (DESIGN.md §11)
//   - console errors
// Then it exercises: hamburger → drawer (Simple), hamburger → 60px rail (Advanced), Escape closes the drawer,
// theme button label matches what is rendered, and the account menu exposes Guide/Advanced on phones.
//
// Required test ids (add them in Phase 1): app-topbar, app-burger, app-rail, nav-drawer, toggle-advanced, toggle-guide,
// theme-toggle, account-menu-button, account-menu.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const args = process.argv.slice(2)
const opt = (n, f) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : f }
const APP = opt('--app', process.env.APP_URL ?? 'http://localhost:5198')
const API = opt('--api', process.env.API_URL ?? 'http://localhost:5080')
// The app needs a signed-in guest (the API runs in demo mode), exactly as check-devices does.
const guest = await (await fetch(`${API}/api/v1/auth/guest`, { method: 'POST' })).json().catch(() => null)
if (!guest?.token) { console.error(`Could not sign in as a guest at ${API}. Is the API running in demo mode?`); process.exit(2) }
const signIn = ([t, g]) => { try { localStorage.setItem('op-theme', t); localStorage.setItem('op.guestToken', JSON.stringify(g)); localStorage.setItem('op.onboarded', '1'); localStorage.setItem('op.coach.off', '1') } catch {} }
const ROUTES = ['/', '/wellfound', '/opportunities', '/outreach', '/campaigns', '/campaigns/new', '/follow-ups', '/insights',
  '/profiles', '/settings', '/connectors', '/how-it-works', '/staffing', '/staffing/candidates', '/does-not-exist']
const ADV_ONLY = new Set(['/campaigns', '/campaigns/new', '/follow-ups', '/insights', '/connectors', '/how-it-works', '/staffing', '/staffing/candidates'])
const fails = []
const tid = (id) => `[data-testid="${id}"]`

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch())
for (const width of [1280, 1024, 375]) for (const theme of ['light', 'dark']) for (const adv of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: theme })
  await ctx.addInitScript(signIn, [theme, guest])
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 429/.test(m.text())) errors.push(m.text()) })
  await page.goto(APP + '/', { waitUntil: 'networkidle' })
  // set Advanced the way a person would at this width
  const advOn = async () => (await page.getAttribute(tid('toggle-advanced'), 'aria-checked').catch(() => null)) === 'true'
  if ((await advOn()) !== adv) {
    if (await page.isVisible(tid('toggle-advanced'))) await page.click(tid('toggle-advanced'))
    else { await page.click(tid('account-menu-button')); await page.click(`${tid('account-menu')} ${tid('toggle-advanced')}`) }
  }
  for (const route of ROUTES) {
    if (!adv && ADV_ONLY.has(route)) continue
    await page.goto(APP + route, { waitUntil: 'networkidle' })
    const tag = `${width} ${theme} ${adv ? 'advanced' : 'simple'} ${route}`
    const m = await page.evaluate((ids) => {
      const top = document.querySelector(ids.top), burger = document.querySelector(ids.burger)
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        topH: top ? top.offsetHeight : -1,
        topWrap: top ? top.scrollHeight > top.clientHeight + 1 : true,
        burger: !!(burger && burger.offsetParent),
      }
    }, { top: tid('app-topbar'), burger: tid('app-burger') })
    if (m.topH < 0) fails.push(`${tag}: no [data-testid=app-topbar]`)
    else if (m.topH > 52 || m.topWrap) fails.push(`${tag}: top bar wraps (${m.topH}px)`)
    if (!m.burger) fails.push(`${tag}: hamburger missing`)
    if (m.overflow) fails.push(`${tag}: sideways scroll`)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    axe.violations.forEach((v) => fails.push(`${tag}: axe ${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`))
    if (errors.length) { fails.push(`${tag}: console — ${errors.join(' | ')}`); errors.length = 0 }
  }
  await ctx.close()
}

// interactions at laptop width
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await ctx.addInitScript(signIn, ['light', guest])
  const p = await ctx.newPage()
  const check = (name, ok, extra = '') => { if (!ok) fails.push(`interaction: ${name} ${extra}`); console.log(`${ok ? '✓' : '✗'} ${name} ${extra}`) }
  await p.goto(APP + '/', { waitUntil: 'networkidle' })
  await p.click(tid('app-burger')); check('Simple: hamburger opens the drawer', await p.isVisible(tid('nav-drawer')))
  await p.keyboard.press('Escape'); check('Escape closes the drawer', !(await p.isVisible(tid('nav-drawer'))))
  if ((await p.getAttribute(tid('toggle-advanced'), 'aria-checked')) !== 'true') await p.click(tid('toggle-advanced'))
  const w1 = await p.$eval(tid('app-rail'), (r) => r.offsetWidth); await p.click(tid('app-burger'))
  const w2 = await p.$eval(tid('app-rail'), (r) => r.offsetWidth); await p.click(tid('app-burger'))
  check('Advanced: hamburger collapses the rail to 60px', w1 >= 200 && w2 <= 64, `${w1} → ${w2}`)
  const label = await p.getAttribute(tid('theme-toggle'), 'aria-label')
  const dark = await p.evaluate(() => { const a = document.documentElement.dataset.theme; return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches })
  check('Theme button label matches what is rendered', /System/.test(label) || (dark ? /Dark/.test(label) : /Light/.test(label)), label)
  await ctx.close()
  const phone = await browser.newContext({ viewport: { width: 375, height: 800 } })
  await phone.addInitScript(signIn, ['light', guest])
  const q = await phone.newPage(); await q.goto(APP + '/', { waitUntil: 'networkidle' })
  await q.click(tid('account-menu-button'))
  check('Phone: Guide and Advanced are in the account menu', await q.isVisible(`${tid('account-menu')} ${tid('toggle-advanced')}`) && await q.isVisible(`${tid('account-menu')} ${tid('toggle-guide')}`))
  await phone.close()
}
await browser.close()
console.log(fails.length ? `\n${fails.length} problem(s):\n` + fails.map((f) => '  ✗ ' + f).join('\n') : '\nAll shell checks passed.')
process.exit(fails.length ? 1 : 0)
