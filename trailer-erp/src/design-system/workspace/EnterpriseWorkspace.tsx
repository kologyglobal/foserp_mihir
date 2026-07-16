import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ErpCardFormPage } from '../../components/erp/card-form/ErpCardFormPage'
import { ErpFormValidationSummary } from '../../components/erp/card-form/ErpFormValidationSummary'
import { cn } from '../../utils/cn'
import { EnterpriseDocumentStrip } from './EnterpriseDocumentStrip'
import { EnterpriseValidationGuide } from './EnterpriseValidationGuide'
import { EnterpriseWorkspaceHeader } from './EnterpriseWorkspaceHeader'
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
  documentStrip,
  completion: _completion,
  validationItems,
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
  suppressFactBoxRecord = false,
  tabs,
  activeTab,
  onTabChange,
  statusStrip,
  insights,
}: EnterpriseWorkspaceProps) {
  const { pathname } = useLocation()
  const useCollapsibleFactBox = Boolean(factBox && collapsibleFactBox)
  const factBoxPaneKey = useCollapsibleFactBox ? `erp-factbox:${pathname}` : undefined
  const [factBoxOpen, setFactBoxOpenState] = useState(() => {
    if (!factBoxPaneKey) return true
    try {
      return sessionStorage.getItem(factBoxPaneKey) !== '0'
    } catch {
      return true
    }
  })

  const setFactBoxOpen = useCallback((next: boolean) => {
    setFactBoxOpenState(next)
    if (factBoxPaneKey) {
      try {
        sessionStorage.setItem(factBoxPaneKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
  }, [factBoxPaneKey])

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
    <EnterpriseValidationGuide items={validationItems} errors={validationErrors} />
  )

  const showLegacyValidation = validationErrors?.length && !validationItems?.length

  const recordPanel = (
    <div className="ent-ws-factbox-record">
      {workspaceHeader}
      {documentStrip && documentStrip.length > 0 ? (
        <EnterpriseDocumentStrip fields={documentStrip} className="ent-ws-doc-strip--factbox" />
      ) : null}
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
      commandBar={commandBar}
      insights={insights}
      statusStrip={statusStrip}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actionRow={headerInFactbox ? undefined : workspaceHeader}
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
      factBoxStorageKey={factBoxPaneKey}
      enableKeyboardShortcuts
      onSaveShortcut={onSaveShortcut}
      onSaveCloseShortcut={onSaveCloseShortcut}
      onSaveAndNewShortcut={onSaveAndNewShortcut}
      className={cn(
        'enterprise-workspace',
        headerInFactbox && 'enterprise-workspace--record-in-factbox',
        useCollapsibleFactBox && !factBoxOpen && 'enterprise-workspace--factbox-collapsed',
        className,
      )}
    >
      {!headerInFactbox && !suppressFactBoxRecord && documentStrip && documentStrip.length > 0 ? (
        <EnterpriseDocumentStrip fields={documentStrip} />
      ) : null}
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
