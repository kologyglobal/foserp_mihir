import type { ReactNode } from 'react'



import {

  EnterpriseWorkspace,

  ENTERPRISE_FORM_CLASS,

  ENTERPRISE_FORM_DETAIL_CLASS,

  type EnterpriseWorkspaceProps,

} from '../../design-system/workspace'

import type { ErpCardFormStatusItem, ErpCardTab } from '../../components/erp/card-form'

import type { PageInsight } from '../../components/design-system/PageInsightsStrip'

import type {

  EnterpriseDocumentFact,

  EnterpriseDocumentIdentity,

  EnterpriseDocumentStripField,

} from '../../design-system/workspace/types'

import { cn } from '../../utils/cn'

import { FactBoxPaneAiToggle } from '../erp/card-form/FactBoxPaneAiToggle'

import { PURCHASE_FACTBOX_COLLAPSED_KEY } from '../erp/card-form/factBoxOpenDefaults'

import { purchaseBreadcrumbs } from './purchaseCardFormShared'

import { purchaseStatusStripToDocumentStrip } from './PurchaseEnterpriseFormKit'

import {

  PurchaseDocumentRecordHeader,

  type PurchaseDocumentRecordHeaderFact,

} from './PurchaseDocumentRecordHeader'



type PurchaseCardFormShellProps = {

  title: string

  description: string

  recordNo?: string

  recordTitle?: string

  status: string

  statusTone?: EnterpriseWorkspaceProps['statusTone']

  /** Raw status key for sticky-header StatusBadge tone (defaults to status). */

  statusKey?: string

  company?: string

  owner?: string

  createdDate?: string

  createdBy?: string

  modifiedDate?: string

  modifiedBy?: string

  favoritePath: string

  breadcrumbs: { label: string; to?: string }[]

  insights?: PageInsight[]

  commandBar?: ReactNode

  /** Legacy chip strip — merged into documentStrip when documentStrip omitted */

  statusStrip?: ErpCardFormStatusItem[]

  /** @deprecated Prefer documentIdentity + documentFacts + documentMetaChips */

  documentStrip?: EnterpriseDocumentStripField[]

  /**

   * @deprecated Prefer `recordHeaderFacts` (CRM Quotation-style sticky header).

   * When set without recordHeaderFacts, still renders EnterpriseDocumentHeader in the form body.

   */

  documentIdentity?: EnterpriseDocumentIdentity

  documentFacts?: EnterpriseDocumentFact[]

  documentMetaChips?: string[]

  /**

   * CRM Quotation-style compact meta row under the document title

   * (e.g. Vendor / Buyer / Date). Enables sticky workspace record header.

   */

  recordHeaderFacts?: PurchaseDocumentRecordHeaderFact[]

  /** Optional mono chip before status (e.g. R0). */

  recordHeaderId?: string

  /**

   * Hide chrome title/fav — sticky PurchaseDocumentRecordHeader owns identity.

   * Defaults true when `recordHeaderFacts` is provided.

   */

  workspaceRecordHeader?: boolean

  /** Tab mode (legacy). Prefer section nav + scroll like CRM 360. */

  tabs?: ErpCardTab[]

  activeTab?: string

  onTabChange?: (tab: string) => void

  validationErrors?: string[]

  validationItems?: EnterpriseWorkspaceProps['validationItems']

  validationTitle?: string

  factBox?: ReactNode

  footer: ReactNode

  onSubmit?: (e: React.FormEvent) => void

  onSaveShortcut?: () => void

  onSaveCloseShortcut?: () => void

  onSaveAndNewShortcut?: () => void

  children: ReactNode

  collapsibleFactBox?: boolean

  stickyFooter?: boolean

  /** 360 / view mode — CRM detail theme (section scroll, view fields). */

  detailMode?: boolean

  className?: string

  suppressFactBoxRecord?: boolean

  /** Persist FactBox hide preference. Defaults to `purchase.factbox.collapsed` when factBox is set. */

  factBoxStorageKey?: string

  factBoxLabel?: string

  factBoxSubtitle?: string

}



/** Purchase domain wrapper — CRM Quotation-aligned sticky record header + Enterprise Workspace. */

export function PurchaseCardFormShell({

  title,

  description,

  recordNo,

  recordTitle,

  status,

  statusTone = 'info',

  statusKey,

  company,

  owner,

  createdDate,

  createdBy,

  modifiedDate,

  modifiedBy,

  favoritePath,

  breadcrumbs,

  insights,

  commandBar,

  statusStrip = [],

  documentStrip,

  documentIdentity,

  documentFacts,

  documentMetaChips,

  recordHeaderFacts,

  recordHeaderId,

  workspaceRecordHeader,

  tabs,

  activeTab,

  onTabChange,

  validationErrors,

  validationItems,

  validationTitle,

  factBox,

  footer,

  onSubmit,

  onSaveShortcut,

  onSaveCloseShortcut,

  onSaveAndNewShortcut,

  children,

  collapsibleFactBox = Boolean(factBox),

  stickyFooter = true,

  detailMode = false,

  className,

  suppressFactBoxRecord,

  factBoxStorageKey = factBox ? PURCHASE_FACTBOX_COLLAPSED_KEY : undefined,

  factBoxLabel = 'Document Insights',

  factBoxSubtitle = 'AI suggested vendor, history, and next actions for this document.',

}: PurchaseCardFormShellProps) {

  const useStickyRecordHeader =

    workspaceRecordHeader ?? Boolean(recordHeaderFacts && recordHeaderFacts.length > 0)



  const stickyTitle = recordTitle ?? title



  const resolvedCommandBar = useStickyRecordHeader ? (

    <PurchaseDocumentRecordHeader

      title={stickyTitle}

      favoritePath={favoritePath}

      status={status}

      statusKey={statusKey}

      idChip={recordHeaderId}

      facts={recordHeaderFacts}

      actions={commandBar}

    />

  ) : (

    commandBar

  )



  /** Sticky header replaces in-body EnterpriseDocumentHeader — avoid dual stacks. */

  const resolvedDocumentIdentity = useStickyRecordHeader ? undefined : documentIdentity

  const resolvedDocumentFacts = useStickyRecordHeader ? undefined : documentFacts

  const resolvedDocumentMetaChips = useStickyRecordHeader ? undefined : documentMetaChips



  const resolvedDocumentStrip = resolvedDocumentIdentity

    ? undefined

    : documentStrip ?? (statusStrip.length ? purchaseStatusStripToDocumentStrip(statusStrip) : undefined)



  const themeClass = detailMode

    ? `${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview`

    : `${ENTERPRISE_FORM_CLASS} enterprise-workspace--crm-smart-overview`



  // children are passed as JSX, not via the props object

  const shellProps: Omit<EnterpriseWorkspaceProps, 'children'> = {

    title,

    description,

    badge: 'Purchase',

    recordNo: recordNo ?? (title.startsWith('New ') ? 'New' : recordNo),

    recordTitle: recordTitle ?? title,

    status,

    statusTone,

    company,

    owner,

    createdDate,

    createdBy,

    modifiedDate,

    modifiedBy,

    favoritePath,

    breadcrumbs: purchaseBreadcrumbs(...breadcrumbs),

    insights,

    commandBar: resolvedCommandBar,

    documentStrip: useStickyRecordHeader ? undefined : resolvedDocumentStrip,

    documentIdentity: resolvedDocumentIdentity,

    documentFacts: resolvedDocumentFacts,

    documentMetaChips: resolvedDocumentMetaChips,

    validationErrors,

    validationItems,

    validationTitle,

    factBox,

    footer,

    onSubmit,

    onSaveShortcut,

    onSaveCloseShortcut,

    onSaveAndNewShortcut,

    collapsibleFactBox,

    factBoxLabel,

    factBoxSubtitle,

    factBoxStorageKey,

    workspaceRecordHeader: useStickyRecordHeader,

    showAi: useStickyRecordHeader ? false : undefined,

    className: cn(

      themeClass,

      factBox && 'enterprise-workspace--purchase-doc-factbox',

      useStickyRecordHeader && 'crm-lead-form-page--sticky-record',

      className,

    ),

    stickyFooter,

    suppressFactBoxRecord: useStickyRecordHeader ? true : suppressFactBoxRecord,

  }



  if (tabs?.length) {

    shellProps.tabs = tabs

    shellProps.activeTab = activeTab

    shellProps.onTabChange = onTabChange

    shellProps.statusStrip = statusStrip

  }



  return (

    <EnterpriseWorkspace {...shellProps}>

      {factBox && collapsibleFactBox ? (

        <div className="erp-form-body__toolbar">

          <FactBoxPaneAiToggle />

        </div>

      ) : null}

      {children}

    </EnterpriseWorkspace>

  )

}



export type { PurchaseDocumentRecordHeaderFact }


