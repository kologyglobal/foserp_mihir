import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ErpCardCommandAction, ErpCardFormStatusItem, ErpCardTab } from '../../components/erp/card-form/types'
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

/** Document-level identity for Purchase/CRM document header hierarchy */
export interface EnterpriseDocumentIdentity {
  /** Eyebrow / module label, e.g. "PURCHASE ORDER" */
  moduleLabel?: string
  title: string
  status?: string
  statusTone?: EnterpriseWorkspaceMetaItem['tone']
}

export interface EnterpriseDocumentFact {
  label: string
  value: string
  /** Softer value styling for placeholders like "Not selected" */
  muted?: boolean
  emphasize?: boolean
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
  /**
   * Standard CRM create/edit save actions for the Dynamics header command bar.
   * Used when `commandBar` is omitted — renders Save / Save & New / Save & Close / Cancel.
   * Do not pass on read-only 360 pages (those supply their own lifecycle commandBar).
   */
  formSaveActions?: {
    onSave: () => void
    onSaveAndNew?: () => void
    onSaveAndClose?: () => void
    onCancel: () => void
    saveLabel?: string
    isSubmitting?: boolean
    extraHomeActions?: ErpCardCommandAction[]
    moreActions?: ErpCardCommandAction[]
  }
  documentStrip?: EnterpriseDocumentStripField[]
  /**
   * Preferred document hierarchy (identity + facts + secondary chips).
   * When set, replaces the fragmented documentStrip highlight boxes.
   */
  documentIdentity?: EnterpriseDocumentIdentity
  documentFacts?: EnterpriseDocumentFact[]
  documentMetaChips?: string[]
  completion?: { percent: number; items: EnterpriseCompletionItem[] }
  validationItems?: EnterpriseValidationItem[]
  /** Overrides EnterpriseValidationGuide title (default: Complete before saving) */
  validationTitle?: string
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
   * Persistence key for FactBox open/collapsed preference.
   * Defaults to `erp-factbox:${pathname}` (sessionStorage).
   * Prefer `purchase.factbox.collapsed` (localStorage) for purchase documents.
   */
  factBoxStorageKey?: string
  /**
   * When false, do not prepend the default record header / document strip into the fact box.
   * Use when the factBox content already includes a compact header (e.g. lead smart overview).
   */
  suppressFactBoxRecord?: boolean
  /** Hide chrome title/fav — commandBar is the sticky record header */
  workspaceRecordHeader?: boolean
  /** View/detail back — top of workspace header */
  backLink?: { to: string; label: string }
  /** Optional tab strip (purchase PO, legacy CRM edit flows) */
  tabs?: ErpCardTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  statusStrip?: ErpCardFormStatusItem[]
  insights?: PageInsight[]
}
