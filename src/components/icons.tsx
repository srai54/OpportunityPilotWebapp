/**
 * One icon set for the whole app: Lucide (open source, MIT). Decorative only: always next to a visible or `.sr-only` text label
 * (or inside a control with an `aria-label`), so they are `aria-hidden`. They draw with `currentColor`, following their container.
 * Add a name here and use `<Icon name="…" />`; do not paste inline SVG or use emoji as icons.
 */

import {
  Activity, ArrowDown, ArrowUp, BarChart3, Briefcase, Building2, Calendar, Check, CheckCircle2, ChevronDown, CircleHelp, Clock, Download, FileCheck2, HandCoins,
  LayoutDashboard, Link2, ListChecks, Lock, Mail, Menu, Mic, Plug, RefreshCw, Search, Send, SlidersHorizontal, Sparkles, Target,
  MapPin, Banknote, Minus, TrendingUp, TriangleAlert, User, Users, type LucideIcon,
} from 'lucide-react'

const ICONS = {
  overview: LayoutDashboard,
  campaigns: Target,
  opportunities: ListChecks,
  approvals: CheckCircle2,
  applications: FileCheck2,
  outreach: Send,
  followUps: Clock,
  profiles: User,
  integrations: Plug,
  settings: SlidersHorizontal,
  menu: Menu,
  candidate: User,
  sales: Building2,
  chevronDown: ChevronDown,
  alert: TriangleAlert,
  projects: Briefcase,
  bids: HandCoins,
  help: CircleHelp,
  insights: BarChart3,
  search: Search,
  mic: Mic,
  mail: Mail,
  calendar: Calendar,
  check: Check,
  refresh: RefreshCw,
  lock: Lock,
  link: Link2,
  trend: TrendingUp,
  people: Users,
  sparkles: Sparkles,
  download: Download,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  minus: Minus,
  pulse: Activity,
  place: MapPin,
  pay: Banknote,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  /** Rendered width and height in px. */
  size?: number
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  const Glyph = ICONS[name]
  return <Glyph className={className} size={size} strokeWidth={1.7} aria-hidden="true" focusable="false" />
}
