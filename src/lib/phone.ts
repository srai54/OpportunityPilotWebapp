/* Phone numbers for tap-to-call (tel:) and WhatsApp (wa.me) links. Calls go through the person's own phone: no telephony cost. */

/** Strip spaces, dashes, dots and brackets; keep one leading "+". "" when nothing usable (fewer than 6 digits) is left. */
export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  const plus = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)
  if (digits.length < 6 || digits.length > 15) return ''
  // An Indian mobile written as 10 digits (or with a trunk 0) gets +91.
  if (!plus) {
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`
    if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`
    if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`
    return digits
  }
  return `+${digits}`
}

/** `tel:` link for a number, or null when there is no usable number. */
export function toTel(raw: string | null | undefined): string | null {
  const n = normalisePhone(raw)
  return n ? `tel:${n}` : null
}

/** `https://wa.me/<digits>?text=…` (WhatsApp opens with the text; the person presses Send), or null without a number. */
export function toWhatsApp(raw: string | null | undefined, text = ''): string | null {
  const n = normalisePhone(raw)
  if (!n) return null
  const digits = n.replace(/\D/g, '')
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`
}

/** A readable form: "+91 98765 43210" for Indian mobiles, otherwise the normalised number. */
export function displayPhone(raw: string | null | undefined): string {
  const n = normalisePhone(raw)
  const m = /^\+91([6-9]\d{4})(\d{5})$/.exec(n)
  return m ? `+91 ${m[1]} ${m[2]}` : n
}

/** The first phone-looking number in free text (a note such as "Call Rahul on 98765 43210"), or "". */
export function findPhone(text: string | null | undefined): string {
  if (!text) return ''
  const matches = text.match(/(?:\+|00)?\d[\d\s().-]{6,18}\d/g) ?? []
  for (const m of matches) {
    if (/\d{4}-\d{2}-\d{2}/.test(m)) continue // an ISO date, not a number
    const n = normalisePhone(m)
    if (n.replace(/\D/g, '').length >= 10) return n
  }
  return ''
}
