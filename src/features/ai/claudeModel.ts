/** Bring your own Claude key (2026-10-26): what the API returns and the checks made before sending a key. */
export interface ClaudeStatus { connected: boolean; keyHint: string | null; model: string; models: string[]; shareWithCandidates: boolean; checkedAt: string | null; canStore: boolean }

export const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 — best quality',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 — fast, lower cost',
  'claude-haiku-5-5': 'Claude Haiku 5.5 — fastest, lowest cost',
}

/** Why this text is not an Anthropic API key, or null when it looks like one. Checked again (with a test call) on the server. */
export function keyProblem(raw: string): string | null {
  const key = raw.trim()
  if (!key) return 'Paste your Anthropic API key.'
  if (key.startsWith('sk-ant-admin')) return 'That is an Admin key. Paste a normal API key instead.'
  if (!key.startsWith('sk-ant-')) return 'An Anthropic API key starts with sk-ant-. A Claude.ai or Claude Code login cannot be used here.'
  if (/\s/.test(key)) return 'The key has a space in it; copy it again in one piece.'
  if (key.length < 20 || key.length > 300) return 'That does not look like a whole key; copy it again.'
  return null
}
