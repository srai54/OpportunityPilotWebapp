import { describe, expect, it } from 'vitest'
import { keyProblem } from './claudeModel'

describe('Claude key checks', () => {
  it('accepts an API key and refuses the rest with a reason', () => {
    expect(keyProblem('  sk-ant-api03-abcdefghijklmnopqrstuvwxyz  ')).toBeNull()
    expect(keyProblem('')).toMatch(/Paste/)
    expect(keyProblem('sk-ant-admin01-abcdefghijklmnopqrstuvwxyz')).toMatch(/Admin key/)
    expect(keyProblem('my-claude-pro-login')).toMatch(/starts with sk-ant-/)
    expect(keyProblem('sk-ant-api03 abc def ghi jkl mno')).toMatch(/space/)
    expect(keyProblem('sk-ant-x')).toMatch(/whole key/)
  })
})
