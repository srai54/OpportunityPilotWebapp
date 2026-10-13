import { nextTheme, THEME_CHOICES, themeLabel, type ThemeChoice } from './themeModel'
import { useTheme } from './useTheme'

function ThemeGlyph({ choice }: { choice: ThemeChoice }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {choice === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
      {choice === 'dark' && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
      {choice === 'system' && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      )}
    </svg>
  )
}

/** Top bar: one button that cycles System → Light → Dark. */
export function ThemeToggle() {
  const [choice, setChoice] = useTheme()
  const next = nextTheme(choice)
  // For System, say what it currently looks like, so the label always matches what is rendered.
  const shown = choice === 'system' ? `System (${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'})` : themeLabel(choice)
  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="theme-toggle"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${shown}. Switch to ${themeLabel(next)}`}
      title={`Theme: ${shown} (click for ${themeLabel(next)})`}
    >
      <ThemeGlyph choice={choice} />
    </button>
  )
}

/** Settings: the three choices as a radio group. */
export function ThemeChoiceGroup() {
  const [choice, setChoice] = useTheme()
  return (
    <fieldset className="theme-choices">
      <legend className="sr-only">Theme</legend>
      {THEME_CHOICES.map((c) => (
        <label key={c} className={`theme-choice ${c === choice ? 'theme-choice-on' : ''}`}>
          <input type="radio" name="theme" value={c} checked={c === choice} onChange={() => setChoice(c)} />
          <ThemeGlyph choice={c} />
          {themeLabel(c)}
        </label>
      ))}
    </fieldset>
  )
}
