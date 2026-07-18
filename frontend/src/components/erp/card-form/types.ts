import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PageInsight } from '../../design-system/PageInsightsStrip'

export type ErpCardFormSaveMode = 'save' | 'draft' | 'new' | 'close'

export interface ErpCardTab {
  id: string
  label: string
  icon?: LucideIcon
  count?: number
  hidden?: boolean
}

export interface ErpCardFormStatusItem {
  label: string
  value: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical'
}

export interface ErpCardCommandAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  primary?: boolean
  /** Keep visible on tablet/mobile when secondary home actions collapse into overflow */
  pin?: boolean
  accent?: boolean
  disabled?: boolean
  disabledReason?: string
  danger?: boolean
}

export interface ErpCardFormPageProps {
  title: string
  description?: string
  recordNo?: string
  badge?: string
  statusChip?: ReactNode
  favoritePath?: string
  breadcrumbs?: { label: string; to?: string }[]
  autoBreadcrumbs?: boolean
  variant?: 'default' | 'dynamics'
  insights?: PageInsight[]
  commandBar?: ReactNode
  actionRow?: ReactNode
  statusStrip?: ErpCardFormStatusItem[]
  statusStripExtra?: ReactNode
  tabs?: ErpCardTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  validationErrors?: string[]
  lockedReason?: string
  onSubmit?: (e: React.FormEvent) => void
  formId?: string
  children: ReactNode
  factBox?: ReactNode
  subpage?: ReactNode
  footer?: ReactNode
  stickyFooter?: boolean
  /** BC-style collapsible right details pane */
  collapsibleFactBox?: boolean
  factBoxLabel?: string
  /** Subtitle under Smart Context title */
  factBoxSubtitle?: string
  factBoxStorageKey?: string
  /** Controlled open state for collapsible factbox (optional) */
  factBoxOpen?: boolean
  onFactBoxOpenChange?: (open: boolean) => void
  className?: string
  enableKeyboardShortcuts?: boolean
  onSaveShortcut?: () => void
  onSaveCloseShortcut?: () => void
  onSaveAndNewShortcut?: () => void
  /** Hide chrome title — commandBar is a sticky record header */
  workspaceRecordHeader?: boolean
}

export interface ErpSubpageColumn<T> {
  id: string
  header: string
  width?: string
  align?: 'left' | 'right' | 'center'
  cell: (row: T, index: number) => ReactNode
  editable?: boolean
}
