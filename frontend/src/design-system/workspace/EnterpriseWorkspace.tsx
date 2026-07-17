import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ErpCardFormPage } from '../../components/erp/card-form/ErpCardFormPage'
import { ErpFormValidationSummary } from '../../components/erp/card-form/ErpFormValidationSummary'
import { CrmFormSaveCommandBar } from '../../components/crm/CrmFormSaveCommandBar'
import { cn } from '../../utils/cn'
import { EnterpriseDocumentHeader } from './EnterpriseDocumentHeader'
import { EnterpriseDocumentStrip } from './EnterpriseDocumentStrip'
import { EnterpriseValidationGuide } from './EnterpriseValidationGuide'
import { EnterpriseWorkspaceHeader } from './EnterpriseWorkspaceHeader'
import { getFactBoxInitialOpen, PURCHASE_FACTBOX_COLLAPSED_KEY } from '../../components/erp/card-form/factBoxOpenDefaults'
import type { EnterpriseWorkspaceProps } from './types'

/**
 * Universal Enterprise Workspace — standard layout for every CRM/Sales create/edit document.
 * Header → Record bar → Form (left) + Business Insights (right) → Sticky footer.
 */
export function EnterpriseWorkspace({
  title,
  description,
  badge = 'ERP',
  recordNo,
  recordTitle,
  status,
  statusTone,
  owner,
  priority,
  company,
  lastSaved,
  stage,
  createdDate,
  createdBy,
  modifiedDate,
  modifiedBy,
  showAi = true,
  favoritePath,
  breadcrumbs,
  commandBar,
  formSaveActions,
  documentStrip,
  documentIdentity,
  documentFacts,
  documentMetaChips,
  completion: _completion,
  validationItems,
  validationTitle,
  validationErrors,
  lockedReason,
  aiInsights: _aiInsights,
  factBox,
  footer,
  children,
  onSubmit,
  onSaveShortcut,
  onSaveCloseShortcut,
  onSaveAndNewShortcut,
  formId = 'enterprise-workspace-form',
  className,
  stickyFooter = false,
  collapsibleFactBox = true,
  factBoxLabel = 'Details',
  factBoxStorageKey,
  suppressFactBoxRecord = false,
  tabs,
  activeTab,
  onTabChange,
  statusStrip,
  insights,
  workspaceRecordHeader = false,
  backLink,
}: EnterpriseWorkspaceProps) {
  const { pathname } = useLocation()
  const useCollapsibleFactBox = Boolean(factBox && collapsibleFactBox)
  const factBoxPaneKey = useCollapsibleFactBox
    ? (factBoxStorageKey ?? `erp-factbox:${pathname}`)
    : undefined
  /** Purchase FactBox preference sticks across routes/refresh via localStorage. */
  const useLocalFactBoxStore = factBoxPaneKey === PURCHASE_FACTBOX_COLLAPSED_KEY
  const [factBoxOpen, setFactBoxOpenState] = useState(() => {
    if (!factBoxPaneKey) return true
    return getFactBoxInitialOpen(factBoxPaneKey)
  })

  const setFactBoxOpen = useCallback((next: boolean) => {
    setFactBoxOpenState(next)
    if (factBoxPaneKey) {
      try {
        if (useLocalFactBoxStore) {
          localStorage.setItem(factBoxPaneKey, next ? '0' : '1')
        } else {
          sessionStorage.setItem(factBoxPaneKey, next ? '1' : '0')
        }
      } catch {
        /* ignore */
      }
    }
  }, [factBoxPaneKey, useLocalFactBoxStore])

  const headerInFactbox = Boolean(factBox && useCollapsibleFactBox && factBoxOpen)

  const workspaceHeader = (
    <EnterpriseWorkspaceHeader
      recordNo={recordNo}
      recordTitle={recordTitle}
      status={status}
      statusTone={statusTone}
      stage={stage}
      createdDate={createdDate}
      createdBy={createdBy}
      modifiedDate={modifiedDate}
      modifiedBy={modifiedBy}
      owner={owner}
      priority={priority}
      company={company}
      lastSaved={lastSaved}
      showAi={showAi}
      favoritePath={favoritePath}
      favoriteLabel={title}
    />
  )

  const validationGuide = (
    <EnterpriseValidationGuide
      title={validationTitle}
      items={validationItems}
      errors={validationErrors}
    />
  )

  const showLegacyValidation = validationErrors?.length && !validationItems?.length

  const resolvedCommandBar = commandBar ?? (formSaveActions ? (
    <CrmFormSaveCommandBar
      onSave={formSaveActions.onSave}
      onSaveAndNew={formSaveActions.onSaveAndNew}
      onSaveAndClose={formSaveActions.onSaveAndClose}
      onCancel={formSaveActions.onCancel}
      saveLabel={formSaveActions.saveLabel}
      isSubmitting={formSaveActions.isSubmitting}
      extraHomeActions={formSaveActions.extraHomeActions}
      moreActions={formSaveActions.moreActions}
    />
  ) : undefined)

  const useDocumentHeader = Boolean(documentIdentity)
  /** Prefer identity header in main canvas — never park it in the factbox rail. */
  const documentInfo = useDocumentHeader && documentIdentity ? (
    <EnterpriseDocumentHeader
      identity={documentIdentity}
      facts={documentFacts}
      metaChips={documentMetaChips}
    />
  ) : !headerInFactbox && !suppressFactBoxRecord && documentStrip && documentStrip.length > 0 ? (
    <EnterpriseDocumentStrip fields={documentStrip} />
  ) : null

  const documentInfoFactbox =
    !useDocumentHeader && documentStrip && documentStrip.length > 0 ? (
      <EnterpriseDocumentStrip fields={documentStrip} className="ent-ws-doc-strip--factbox" />
    ) : null

  const recordPanel = (
    <div className="ent-ws-factbox-record">
      {workspaceHeader}
      {documentInfoFactbox}
    </div>
  )

  const composedFactBox = factBox ? (
    <div className="ent-ws-factbox-rail">
      {suppressFactBoxRecord ? null : recordPanel}
      {factBox}
    </div>
  ) : undefined

  return (
    <ErpCardFormPage
      title={title}
      description={description}
      badge={badge}
      variant="dynamics"
      recordNo={recordNo}
      favoritePath={favoritePath}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      commandBar={resolvedCommandBar}
      insights={insights}
      statusStrip={statusStrip}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actionRow={headerInFactbox || workspaceRecordHeader ? undefined : workspaceHeader}
      validationErrors={showLegacyValidation ? validationErrors : undefined}
      lockedReason={lockedReason}
      onSubmit={onSubmit}
      formId={formId}
      factBox={composedFactBox}
      footer={footer}
      stickyFooter={stickyFooter}
      collapsibleFactBox={useCollapsibleFactBox}
      factBoxLabel={factBoxLabel}
      factBoxOpen={useCollapsibleFactBox ? factBoxOpen : undefined}
      onFactBoxOpenChange={useCollapsibleFactBox ? setFactBoxOpen : undefined}
      factBoxStorageKey={useLocalFactBoxStore ? undefined : factBoxPaneKey}
      enableKeyboardShortcuts
      onSaveShortcut={onSaveShortcut}
      onSaveCloseShortcut={onSaveCloseShortcut}
      onSaveAndNewShortcut={onSaveAndNewShortcut}
      workspaceRecordHeader={workspaceRecordHeader}
      backLink={backLink}
      className={cn(
        'enterprise-workspace',
        headerInFactbox && 'enterprise-workspace--record-in-factbox',
        useCollapsibleFactBox && !factBoxOpen && 'enterprise-workspace--factbox-collapsed',
        className,
      )}
    >
      {documentInfo}
      {validationGuide}
      <div className="enterprise-workspace__main">{children}</div>
      {showLegacyValidation ? null : (
        validationErrors?.length ? (
          <ErpFormValidationSummary errors={validationErrors} lockedReason={lockedReason} className="mt-3" />
        ) : null
      )}
    </ErpCardFormPage>
  )
}
