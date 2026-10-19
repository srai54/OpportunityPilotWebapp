#!/usr/bin/env node
// PreToolUse guard for Edit / Write / MultiEdit / NotebookEdit (wired in .claude/settings.json).
// Reads the hook JSON from stdin; exit 2 + stderr blocks the write, exit 0 allows it.
// Blocks: local env files, the lockfile, build output and dependencies, likely secrets in any
// content, and secret-looking VITE_ variables (everything VITE_ ships in the public bundle).
import { readFileSync } from 'node:fs'

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.stderr.write('guard-write: could not read the hook input; allowing.\n')
    process.exit(0)
  }
}

function block(reason, instead) {
  process.stderr.write(`Blocked by .claude/hooks/guard-write.mjs: ${reason}. ${instead}\n`)
  process.exit(2)
}

const input = readInput()
const ti = input?.tool_input ?? {}
const filePath = String(ti.file_path ?? ti.notebook_path ?? '')
const path = filePath.replace(/\\/g, '/')
const base = path.split('/').pop() ?? ''

// The text being written: Write → content, Edit → new_string, MultiEdit → edits[].new_string, NotebookEdit → new_source.
const content = [
  ti.content,
  ti.new_string,
  ti.new_source,
  ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.new_string) : []),
]
  .filter((x) => typeof x === 'string')
  .join('\n')

// ---------- protected paths ----------

const PUBLIC_ENV_FILES = new Set(['.env.example', '.env.production'])
if (/^\.env(\..*)?$/i.test(base) && !PUBLIC_ENV_FILES.has(base)) {
  block(
    `${base} is a local env file (git-ignored, may hold secrets)`,
    'Ask the user to edit it; document new variables in .env.example and docs/PRODUCT.md.',
  )
}
if (base === 'package-lock.json' || base === 'npm-shrinkwrap.json') {
  block(`${base} is generated`, 'Change package.json and run npm install instead.')
}
if (/(^|\/)(dist|node_modules)(\/|$)/.test(path)) {
  block('dist/ and node_modules/ are generated', 'Change the source and rebuild or reinstall.')
}

// ---------- likely secrets in any content ----------

// Built from parts so this file does not match its own patterns (keeps it editable with the hook on).
const ROLE = 'SERVICE' + '_ROLE'
const SECRET_NAME = `SECRET|${ROLE}|PRIVATE|PASSWORD`
const SECRET_PATTERNS = [
  [new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{8,}'), 'a Supabase secret key'],
  [new RegExp('service' + '_role', 'i'), 'a Supabase service-role reference'],
  [new RegExp('AI' + 'za[0-9A-Za-z_-]{30,}'), 'a Google API key'],
  [new RegExp('(?<![A-Za-z0-9])s' + 'k-[A-Za-z0-9_-]{20,}'), 'an sk- API key'],
  [new RegExp('-----BEGIN ([A-Z0-9]+ )*PRIV' + 'ATE KEY-----'), 'a private key block'],
  [new RegExp('op' + 'k_[A-Za-z0-9_-]{30,}'), 'an OpportunityPilot agent key'],
  [new RegExp(`\\bVITE_[A-Z0-9_]*(${SECRET_NAME})[A-Z0-9_]*\\s*[:=]`), 'a secret-looking VITE_ variable (VITE_ values are public)'],
]

for (const [re, what] of SECRET_PATTERNS) {
  if (re.test(content)) {
    block(
      `the content contains ${what}`,
      'Secrets live in server or hosting configuration, never in this repo or in VITE_ variables.',
    )
  }
}

// ---------- the two committed env files: public VITE_ values only ----------

if (PUBLIC_ENV_FILES.has(base)) {
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    const [, name, rawValue] = m
    const value = rawValue.replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '').trim()
    if (!name.startsWith('VITE_')) {
      block(`${name} in ${base} is not a VITE_ variable`, 'The web app reads only public VITE_ values; server settings belong to the API.')
    }
    if (new RegExp(`${SECRET_NAME}|TOKEN`).test(name)) {
      block(`${name} looks like a secret`, 'Never put secrets in VITE_ variables.')
    }
    if (/KEY/.test(name) && !/(PUBLISHABLE|ANON)_KEY$/.test(name)) {
      block(`${name} looks like a private key name`, 'Only the Supabase publishable (anon) key may be a VITE_ value.')
    }
    if (base === '.env.production' && value && /(PUBLISHABLE|ANON)_KEY$/.test(name)) {
      block(`${name} has a value in .env.production`, 'Set it in the Vercel/Render dashboard, not in the committed file.')
    }
  }
}

process.exit(0)
