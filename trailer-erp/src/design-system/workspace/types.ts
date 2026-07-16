import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ErpCardFormStatusItem, ErpCardTab } from '../../components/erp/card-form/types'
import type { PageInsight } from '../../components/design-system/PageInsightsStrip'

export interface EnterpriseWorkspaceMetaItem {
  id: string
  label: string
  value: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical'
  icon?: LucideIcon
}

export interface EnterpriseCompletionItem {
  id: string
  label: string
  done: boolean
  onClick?: () => void
}

export interface EnterpriseValidationItem {
  id: string
  label: string
  message?: string
  onClick?: () => void
}

export interface EnterpriseAiInsight {
  id: string
  label: string
  value: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical'
}

export interface EnterpriseTimelineEvent {
  id: string
  label: string
  time: string
  actor?: string
  status?: 'current' | 'past' | 'future'
}

export interface EnterpriseRelatedRecord {
  id: string
  label: string
  subtitle?: string
  href?: string
  value?: string
}

export interface EnterpriseFinancialLine {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
}

export interface EnterpriseDocumentStripField {
  label: string
  value: string
  highlight?: boolean
}

export interface EnterpriseWorkspaceProps {
  title: string
  description?: string
  badge?: string
  recordNo?: string
  recordTitle?: string
  status?: string
  statusTone?: EnterpriseWorkspaceMetaItem['tone']
  stage?: string
  createdDate?: string
  createdBy?: string
  modifiedDate?: string
  modifiedBy?: string
  owner?: string
  priority?: string
  company?: string
  lastSaved?: string
  showAi?: boolean
  favoritePath?: string
  breadcrumbs?: { label: string; to?: string }[]
  commandBar?: ReactNode
  documentStrip?: EnterpriseDocumentStripField[]
  completion?: { percent: number; items: EnterpriseCompletionItem[] }
  validationItems?: EnterpriseValidationItem[]
  validationErrors?: string[]
  lockedReason?: string
  aiInsights?: EnterpriseAiInsight[]
  factBox?: ReactNode
  footer?: ReactNode
  children: ReactNode
  onSubmit?: (e: React.FormEvent) => void
  onSaveShortcut?: () => void
  onSaveCloseShortcut?: () => void
  onSaveAndNewShortcut?: () => void
  formId?: string
  className?: string
  /** Pin save bar to viewport bottom (default: true) */
  stickyFooter?: boolean
  /** BC-style dismissible right details pane */
  collapsibleFactBox?: boolean
  factBoxLabel?: string
  /**
   * When false, do not prepend the default record header / document strip into the fact box.
   * Use when the factBox content already includes a compact header (e.g. lead smart overview).
   */
  suppressFactBoxRecord?: boolean
  /** Optional tab strip (purchase PO, legacy CRM edit flows) */
  tabs?: ErpCardTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  statusStrip?: ErpCardFormStatusItem[]
  insights?: PageInsight[]
}
