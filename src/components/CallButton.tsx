import { savePendingCall, type CallEntityType, type PendingCall } from '../features/calls/callModel'
import { displayPhone, normalisePhone, toTel } from '../lib/phone'
import { Icon } from './icons'

type CallContext = Omit<PendingCall, 'who' | 'phone' | 'entityType' | 'entityId' | 'at'>

interface CallButtonProps {
  phone: string | null | undefined
  /** Who is called: used in the label ("Call Priya") and in "After the call". */
  who: string
  entityType: CallEntityType
  entityId: string
  /** Ids that let "After the call" save the outcome to the right deal or job. */
  context?: CallContext
  /** Visible text; defaults to "Call {first name}". */
  label?: string
  /** Icon only (round): the accessible name still says who is called. */
  iconOnly?: boolean
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Tap to call through the person's own phone (`tel:` link): the dialler opens with the number, nothing is paid for.
 * Hidden when there is no usable number. The tap is remembered so "After the call" can ask how it went on return.
 */
export function CallButton({ phone, who, entityType, entityId, context, label, iconOnly = false, variant = 'primary', size = 'sm', className = '' }: Readonly<CallButtonProps>) {
  const href = toTel(phone)
  if (!href) return null
  const first = who.trim().split(/\s+/)[0] || who
  const text = label ?? `Call ${first}`
  const remember = () => savePendingCall({ who, phone: normalisePhone(phone), entityType, entityId, at: new Date().toISOString(), ...context })
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', iconOnly ? 'call-btn-icon' : 'call-btn', className].filter(Boolean).join(' ')
  return <a className={cls} href={href} onClick={remember} aria-label={iconOnly ? `Call ${who} on ${displayPhone(phone)}` : undefined}>
    <Icon name="phone" size={iconOnly ? 18 : 15} />
    {!iconOnly && <span>{text}</span>}
  </a>
}
