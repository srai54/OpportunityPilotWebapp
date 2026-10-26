#!/usr/bin/env node
// PreToolUse guard for Bash and PowerShell commands (wired in .claude/settings.json).
// Reads the hook JSON from stdin; exit 2 + stderr blocks the command, exit 0 allows it.
// Blocks: broad recursive force deletes, force pushes, hard resets to a remote ref,
// piping downloads into a shell, --no-verify, and package publishing.
import { readFileSync } from 'node:fs'

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.stderr.write('guard-command: could not read the hook input; allowing.\n')
    process.exit(0)
  }
}

const input = readInput()
const command = String(input?.tool_input?.command ?? '')
if (!command.trim()) process.exit(0)

/** Splits a command line into simple segments on ; && || | and new lines (quotes are not parsed). */
const split = (line) => line.split(/\r?\n|;|&&|\|\||\|/).map((s) => s.trim()).filter(Boolean)

/** Scripts handed to a nested shell (bash -c "…", pwsh -Command '…'), so a wrapped rm -rf / is judged too. */
const nested = [...command.matchAll(/\b(?:sh|bash|zsh|dash|pwsh|powershell)(?:\.exe)?\s+(?:-c|-command)\s+(["'])([\s\S]*?)\1/gi)].map((m) => m[2])

const segments = [...split(command), ...nested.flatMap(split)]

const tokensOf = (segment) =>
  segment
    .split(/\s+/)
    .map((t) => t.replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)

/** Drops leading wrappers such as sudo, command, env assignments and the call operator. */
function commandWords(tokens) {
  let i = 0
  while (i < tokens.length && (/^(sudo|command|exec|nohup|time|&)$/i.test(tokens[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))) i++
  return tokens.slice(i)
}

// ---------- rm -rf / Remove-Item -Recurse -Force on broad targets ----------

const BROAD_TARGET = [
  /^\/\*?$/, // / and /*
  /^~[\\/]?\*?$/, // ~ ~/ ~/*
  /^\.{1,2}[\\/]?\*?$/, // . .. ./ ../ ./*
  /^\*$/, // *
  /^\$\{?HOME\}?[\\/]?\*?$/i, // $HOME
  /^\$env:(USERPROFILE|HOMEPATH|HOME)[\\/]?\*?$/i,
  /^%USERPROFILE%[\\/]?\*?$/i,
  /^[A-Za-z]:[\\/]?\*?$/, // C: C:\ C:/
  /^\/[A-Za-z]\/?\*?$/, // /c /d/ (Git Bash drive roots)
  /(^|[\\/])\.\.([\\/]|$)/, // any parent-directory traversal
  /(^|[\\/])\.git[\\/]?$/, // the repository itself
]

function isBroadTarget(target) {
  if (BROAD_TARGET.some((re) => re.test(target))) return true
  // Absolute paths only two levels deep or less, e.g. /d/OpportunityPilot or C:\Users\55.
  const normalized = target.replace(/\\/g, '/').replace(/\/+$/, '')
  if (/^([A-Za-z]:)?\//.test(normalized)) {
    const depth = normalized.replace(/^[A-Za-z]:/, '').split('/').filter(Boolean).length
    if (depth <= 2) return true
  }
  return false
}

const RM_COMMANDS = new Set(['rm', 'remove-item', 'ri', 'del', 'erase', 'rd', 'rmdir'])

function broadDelete(segment) {
  const words = commandWords(tokensOf(segment))
  if (!words.length || !RM_COMMANDS.has(words[0].toLowerCase())) return null
  let recursive = false
  let force = false
  const targets = []
  for (const token of words.slice(1)) {
    const t = token.toLowerCase()
    if (!t.startsWith('-')) {
      targets.push(token)
      continue
    }
    if (['-r', '--recursive', '-recurse'].includes(t)) recursive = true
    else if (['-f', '--force', '-force', '-fo'].includes(t)) force = true
    else if (/^-[a-z]{2,4}$/.test(t)) {
      if (/r/.test(t)) recursive = true
      if (/f/.test(t)) force = true
    }
  }
  if (!recursive || !force) return null
  const broad = targets.find(isBroadTarget)
  return broad === undefined ? null : broad
}

// ---------- git ----------

function gitArgs(segment) {
  const words = commandWords(tokensOf(segment))
  if (!words.length || !/^git(\.exe)?$/i.test(words[0])) return null
  // Skip global options such as -C <dir> and -c key=value.
  let i = 1
  while (i < words.length && words[i].startsWith('-')) i += /^-(C|c)$/.test(words[i]) ? 2 : 1
  return { sub: (words[i] ?? '').toLowerCase(), args: words.slice(i + 1) }
}

function forcePush(segment) {
  const git = gitArgs(segment)
  if (!git || git.sub !== 'push') return false
  return git.args.some(
    (a) =>
      a === '--force' ||
      a.startsWith('--force-with-lease') ||
      a === '--force-if-includes' ||
      a === '--mirror' ||
      /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) ||
      /^\+[^+]/.test(a),
  )
}

function hardResetToRemote(segment) {
  const git = gitArgs(segment)
  if (!git || git.sub !== 'reset' || !git.args.includes('--hard')) return false
  return git.args.some((a) => /^(origin|upstream)(\/|$)/i.test(a) || /@\{u(pstream)?\}/i.test(a))
}

function skipsHooks(segment) {
  const git = gitArgs(segment)
  if (/(^|\s)--no-verify(\s|=|$)/.test(segment)) return true
  return Boolean(git && git.sub === 'commit' && git.args.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a) && !a.startsWith('--')))
}

// ---------- rules ----------

const rules = [
  {
    hit: () => {
      for (const s of segments) {
        const target = broadDelete(s)
        if (target !== null) return `recursive force delete of a broad path ("${target}")`
      }
      return null
    },
    instead: 'Delete a specific project folder by name (e.g. dist or node_modules) or ask the user to do it.',
  },
  {
    hit: () => (segments.some(forcePush) ? 'force push (--force, -f, --force-with-lease, --mirror or a +refspec)' : null),
    instead: 'main auto-deploys (Vercel); push normally, and only when the user asks.',
  },
  {
    hit: () => (segments.some(hardResetToRemote) ? 'git reset --hard to a remote ref' : null),
    instead: 'It discards local work. Use git stash or a new branch, or ask the user.',
  },
  {
    hit: () =>
      /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(sh|bash|zsh|dash|ksh|fish|pwsh|powershell|python3?|node)\b/i.test(command) ||
      /\b(sh|bash|zsh|dash)\b[^\n]*(<\(|\$\()\s*(curl|wget)\b/i.test(command)
        ? 'piping a download into a shell'
        : null,
    instead: 'Download the script, read it, and run it only with the user’s approval.',
  },
  {
    hit: () =>
      /\b(iwr|irm|invoke-webrequest|invoke-restmethod|curl|wget)\b[^|\n]*\|\s*(iex|invoke-expression)\b/i.test(command) ||
      /\b(iex|invoke-expression)\b\s*[\s(]*\s*(iwr|irm|invoke-webrequest|invoke-restmethod|\(?\s*new-object\s+(system\.)?net\.webclient)/i.test(command)
        ? 'piping a download into Invoke-Expression'
        : null,
    instead: 'Download the script, read it, and run it only with the user’s approval.',
  },
  {
    hit: () => (segments.some(skipsHooks) ? 'skipping git hooks (--no-verify / commit -n)' : null),
    instead: 'Fix what the hook reports instead of bypassing it.',
  },
  {
    hit: () => (/\b(npm|pnpm|yarn|bun)\s+(publish|pub)\b/i.test(command) ? 'publishing a package' : null),
    instead: 'This app is private and is never published to a registry.',
  },
]

for (const rule of rules) {
  const reason = rule.hit()
  if (reason) {
    process.stderr.write(`Blocked by .claude/hooks/guard-command.mjs: ${reason}. ${rule.instead}\n`)
    process.exit(2)
  }
}
process.exit(0)
