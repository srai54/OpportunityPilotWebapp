import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../../components/icons'

/**
 * A modal sheet: slides up from the bottom on phones, a centred dialog on wide screens. Esc and the close button close it;
 * focus moves to the title on open and back to what opened it on close.
 */
export function Sheet({ title, subtitle, onClose, children, footer, avatar, labelId }: Readonly<{
  title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; avatar?: ReactNode; labelId: string
}>) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [])
  return <div className="call-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="call-sheet" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <span className="call-sheet-grip" aria-hidden="true" />
      <header className="call-sheet-head">
        {avatar}
        <div className="call-sheet-titles">
          <h2 id={labelId} ref={titleRef} tabIndex={-1}>{title}</h2>
          {subtitle && <p className="muted-small">{subtitle}</p>}
        </div>
        <button type="button" className="btn btn-secondary call-sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      </header>
      <div className="call-sheet-body">{children}</div>
      {footer && <footer className="call-sheet-foot">{footer}</footer>}
    </div>
  </div>
}
