const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab and Shift+Tab inside a modal: from the last control to the first and back. */
export function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
  if (items.length === 0) { e.preventDefault(); return }
  const first = items[0], last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus() }
}
