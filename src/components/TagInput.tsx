import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { addTags, TAG_MAX_COUNT, TAG_MAX_LENGTH } from '../features/campaigns/campaignModel'
import { suggest } from '../features/suggest/catalog'

interface Props {
  id: string
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: React.ReactNode
  badge?: React.ReactNode
  error?: string
  max?: number
  /** Known values offered while typing (a combobox). Free text is still accepted. */
  suggestions?: readonly string[]
}

/**
 * A list of short phrases. Type and press Enter or comma to add; paste a comma- or line-separated list
 * to add several. Each chip has its own remove button, and changes are announced to screen readers.
 */
export function TagInput({ id, label, values, onChange, placeholder, hint, badge, error, max = TAG_MAX_COUNT, suggestions }: Props) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const full = values.length >= max
  const options = suggestions && open && !full ? suggest(suggestions, draft, values, 8) : []
  const listId = `${id}-options`

  function commit(raw: string) {
    if (!raw.trim()) return
    const r = addTags(values, raw, max)
    if (r.added.length) onChange(r.values)
    const parts = [
      r.added.length ? `Added ${r.added.join(', ')}.` : '',
      r.duplicates.length ? `Already listed: ${r.duplicates.join(', ')}.` : '',
      r.overflow.length ? `List is full (${max}); not added: ${r.overflow.join(', ')}.` : '',
    ]
    setAnnouncement(parts.filter(Boolean).join(' '))
    setDraft('')
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (options.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % options.length : (a - 1 + options.length) % options.length))
      return
    }
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setActive(-1); return }
    if (e.key === 'Enter' && active >= 0 && options[active]) {
      e.preventDefault()
      commit(options[active])
      return
    }
    if (e.key === 'Enter' || e.key === ',') {
      // Enter must not submit the surrounding form.
      e.preventDefault()
      commit(draft)
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (/[,\n;]/.test(text)) {
      e.preventDefault()
      commit(draft + text)
    }
  }

  function remove(tag: string) {
    onChange(values.filter((v) => v !== tag))
    setAnnouncement(`Removed ${tag}.`)
    // The removed button disappears; keep focus inside the control.
    inputRef.current?.focus()
  }

  return (
    <div className="field">
      <div className="row wrap">
        <label htmlFor={id}>{label}</label>
        {badge}
      </div>
      <div className={`tag-input ${error ? 'tag-input-invalid' : ''}`} onClick={() => inputRef.current?.focus()}>
        {values.length > 0 && (
          <ul className="plain-list tag-list" aria-label={`${label}: ${values.length} added`}>
            {values.map((tag) => (
              <li key={tag} className="tag">
                <span className="tag-text">{tag}</span>
                <button type="button" className="tag-remove" aria-label={`Remove ${tag}`} onClick={() => remove(tag)}>
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          maxLength={TAG_MAX_LENGTH * 4}
          disabled={full}
          placeholder={full ? `Limit of ${max} reached` : placeholder}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          role={suggestions ? 'combobox' : undefined}
          aria-expanded={suggestions ? options.length > 0 : undefined}
          aria-controls={suggestions ? listId : undefined}
          aria-autocomplete={suggestions ? 'list' : undefined}
          aria-activedescendant={suggestions && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          onChange={(e) => { setDraft(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => { setOpen(false); setActive(-1); commit(draft) }}
        />
      </div>
      {suggestions && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="suggest-list" hidden={options.length === 0}>
          {options.map((o, i) => (
            <li key={o} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? 'suggest-option is-active' : 'suggest-option'}
              // mousedown (not click) so the input keeps focus and its blur handler does not swallow the choice
              onMouseDown={(e) => { e.preventDefault(); commit(o) }}>
              {o}
            </li>
          ))}
        </ul>
      )}
      <p id={hintId} className="hint">
        {hint ? <>{hint} </> : null}Press Enter or comma to add.
      </p>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
