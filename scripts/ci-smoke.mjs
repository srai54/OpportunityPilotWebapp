// Browser smoke test for CI (2026-10-26): the built app, served by `vite preview`, with the API mocked from recorded fixtures
// (scripts/fixtures/*.json, the labelled sample candidate — no real person). Runs without the API, so it can gate every PR.
//
//   npm run build && node scripts/ci-smoke.mjs        (CI: after `npx playwright install --with-deps chromium`)
//
// Candidate page (/progress/<token>) at 1280 light and 375 dark: the page and its sections render, the resume builder opens, "Tailor to
// this job" shows the result and "Use this version" applies it; fails on axe WCAG 2.1 AA violations, sideways scroll or console errors.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = (name) => readFileSync(join(ROOT, 'scripts', 'fixtures', `${name}.json`), 'utf8')
const PORT = 4179
const APP = `http://localhost:${PORT}`
const TOKEN = 'ci-smoke-token'
const problems = []

const preview = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' })
const stop = () => { try { preview.kill() } catch { /* already stopped */ } }
process.on('exit', stop)

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(APP)).ok) return } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview did not start')
}

/** Every API call answered from fixtures; anything unexpected gets a 404 and is listed. */
async function mockApi(page) {
  await page.route(/\/api\/v1\//, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body })
    if (path.endsWith('/tailor')) return json(fixture('tailor'))
    if (path.endsWith(`/progress/${TOKEN}/resumes`)) return json(fixture('resumes'))
    if (path.endsWith(`/progress/${TOKEN}/journey`)) return json(fixture('journey'))
    if (path.endsWith(`/progress/${TOKEN}`)) return json(fixture('progress'))
    if (path === '/api/v1/client-errors') return route.fulfill({ status: 202 })
    return json('{"title":"Not found"}', 404)
  })
}

await waitForServer()
// CI installs Playwright's Chromium; locally SMOKE_CHANNEL=msedge uses the installed Edge instead.
const browser = await chromium.launch(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {})
try {
  for (const [width, height, scheme] of [[1280, 900, 'light'], [375, 812, 'dark']]) {
    const tag = `${width} ${scheme}`
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme })
    const page = await ctx.newPage()
    page.on('console', (m) => { if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text())) problems.push(`${tag}: console error: ${m.text()}`) })
    page.on('pageerror', (e) => problems.push(`${tag}: page error: ${e.message}`))
    await mockApi(page)
    await page.goto(`${APP}/progress/${TOKEN}`)
    await page.getByRole('button', { name: 'Open my resume' }).first().waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: 'Open my resume' }).first().click()
    const tailor = page.getByRole('button', { name: 'Tailor to this job' }).first()
    await tailor.waitFor({ timeout: 10000 })
    await tailor.click()
    const result = page.locator('.rb-tailor-result').first()
    await result.waitFor({ timeout: 10000 })
    if (!/JD match/.test(await result.innerText())) problems.push(`${tag}: the tailoring result does not show the JD match`)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    for (const v of axe.violations) problems.push(`${tag}: axe ${v.id} (${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')})`)
    await page.getByRole('button', { name: 'Use this version' }).click()
    if (!(await page.getByText('Tailored version in place').count())) problems.push(`${tag}: "Use this version" did not apply the result`)
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push(`${tag}: sideways scroll`)
    console.log(`${tag}: candidate page, resume builder and tailoring checked`)
    await ctx.close()
  }
} finally {
  await browser.close()
  stop()
}

if (problems.length) {
  console.error(`Smoke test failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log('Smoke test passed.')
