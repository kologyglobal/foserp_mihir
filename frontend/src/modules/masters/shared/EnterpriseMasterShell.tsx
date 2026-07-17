import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Download, FileText, Pencil, Plus, Save, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErpCardCommandBar } from '../../../components/erp/card-form/ErpCardCommandBar'
import { ErpCardSection } from '../../../components/erp/card-form'
import type { ErpCardSectionProps } from '../../../components/erp/card-form/ErpCardSection'
import { ErpStickySaveBar } from '../../../components/erp/card-form/ErpStickySaveBar'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { FactBoxPaneAiToggle } from '../../../components/erp/card-form/FactBoxPaneAiToggle'
import type { MasterCatalogGroupId } from '../../../config/mastersSetupCatalog'
import { getMasterGroupById } from '../../../config/mastersSetupCatalog'
import {
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
  EnterpriseWorkspace,
  type EnterpriseFormMetric,
  type EnterpriseFormSectionNavItem,
} from '../../../design-system/workspace'
import { cn } from '../../../utils/cn'
import {
  appendAuditStripFields,
  type RecordAuditView,
  resolveRecordCreatedBy,
  resolveRecordCreatedDate,
} from '../../../utils/masterAudit'
import { formatDateTime } from '../../../utils/dates/format'
import { notify } from '../../../store/toastStore'
const GROUP_ACCENT_CLASS: Record<string, string> = {
  blue: 'masters-module-chip-blue',
  green: 'masters-module-chip-green',
  amber: 'masters-module-chip-amber',
  purple: 'masters-module-chip-purple',
  indigo: 'masters-module-chip-indigo',
  cyan: 'masters-module-chip-cyan',
  rose: 'masters-module-chip-rose',
  slate: 'masters-module-chip-slate',
}

export function MasterFormCommandBar({
  listPath,
  onSave,
  onSaveClose,
  onSaveNew,
  onCancel,
  isEdit,
  isSubmitting,
}: {
  listPath: string
  onSave: () => void
  onSaveClose: () => void
  onSaveNew: () => void
  onCancel: () => void
  isEdit?: boolean
  isSubmitting?: boolean
}) {
  return (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'save', label: isSubmitting ? 'Saving…' : 'Save', icon: Save, primary: true, disabled: isSubmitting, onClick: onSave },
        { id: 'save-close', label: 'Save & Close', icon: Save, disabled: isSubmitting, onClick: onSaveClose },
        ...(isEdit ? [] : [{ id: 'save-new', label: 'Save & New', icon: Plus, disabled: isSubmitting, onClick: onSaveNew }]),
      ]}
      moreActions={[
        { id: 'import', label: 'Import', icon: Upload, onClick: () => notify.info('Import wizard — connect CSV template in backend phase.') },
        { id: 'export', label: 'Export', icon: Download, onClick: () => notify.info('Export queued — download from list page.') },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: onCancel },
        { id: 'list', label: 'Back to list', onClick: () => { window.location.href = listPath } },
      ]}
    />
  )
}

/** Alias for form pages using legacy `MasterForm` import */
export const MasterForm = MasterFormCommandBar

export function MasterStickyFooter({
  onSave,
  onSaveClose,
  onSaveNew,
  onCancel,
  isSubmitting,
  hint,
  isEdit,
}: {
  onSave: () => void
  onSaveClose: () => void
  onSaveNew: () => void
  onCancel: () => void
  isSubmitting?: boolean
  hint?: ReactNode
  isEdit?: boolean
}) {
  return (
    <ErpStickySaveBar
      onCancel={onCancel}
      onSave={onSave}
      onSaveAndClose={onSaveClose}
      onSaveAndNew={isEdit ? undefined : onSaveNew}
      isSubmitting={isSubmitting}
      hint={hint}
    />
  )
}

/** SAP / BC-style section card — visible only when its section tab is active */
export function MasterFormSection({
  sectionId,
  activeSection,
  children,
  ...sectionProps
}: ErpCardSectionProps & {
  sectionId: string
  activeSection: string
}) {
  if (activeSection !== sectionId) return null
  return (
    <ErpCardSection {...sectionProps} collapsible defaultOpen className={cn('masters-standard-section', sectionProps.className)}>
      {children}
    </ErpCardSection>
  )
}

export interface EnterpriseMasterWorkspaceProps {
  badge?: string
  title: string
  subtitle?: string
  breadcrumbs: { label: string; to?: string }[]
  masterGroupId?: MasterCatalogGroupId
  favoritePath?: string
  recordNo?: string
  isActive?: boolean
  documentStrip: { label: string; value: string; highlight?: boolean }[]
  recordAudit?: RecordAuditView
  pendingAuditUserName?: string
  commandBar: ReactNode
  sectionNavItems: EnterpriseFormSectionNavItem[]
  activeSection: string
  onSectionSelect: (id: string) => void
  formMetrics: EnterpriseFormMetric[]
  factBoxTitle?: string
  factBoxSummary: { label: string; value: string; highlight?: boolean }[]
  factBoxActions?: { id: string; label: string; onClick: () => void; primary?: boolean }[]
  validationErrors?: string[]
  lockedReason?: string
  formId?: string
  onSubmit?: (e: FormEvent) => void
  onSaveShortcut?: () => void
  onSaveCloseShortcut?: () => void
  onSaveAndNewShortcut?: () => void
  children: ReactNode
  stickyFooter?: ReactNode
}

export function EnterpriseMasterWorkspace({
  badge,
  title,
  subtitle,
  breadcrumbs,
  masterGroupId,
  favoritePath,
  recordNo,
  isActive,
  documentStrip,
  recordAudit,
  pendingAuditUserName,
  commandBar,
  sectionNavItems,
  activeSection,
  onSectionSelect,
  formMetrics,
  factBoxTitle,
  factBoxSummary,
  factBoxActions,
  validationErrors,
  lockedReason,
  formId = 'master-standard-form',
  onSubmit,
  onSaveShortcut,
  onSaveCloseShortcut,
  onSaveAndNewShortcut,
  children,
  stickyFooter,
}: EnterpriseMasterWorkspaceProps) {
  const group = masterGroupId ? getMasterGroupById(masterGroupId) : undefined
  const GroupIcon = group?.icon
  const auditView = recordAudit ?? {}
  const composedStrip = appendAuditStripFields(documentStrip, auditView, { pendingUserName: pendingAuditUserName })

  const factBox = (
    <EnterpriseBusinessFactBox title={factBoxTitle ?? 'Master insight'}>
      <EnterpriseFormContextPanel
        summaryTitle="Summary"
        actionsTitle="Quick Actions"
        summary={factBoxSummary}
        actions={factBoxActions?.map((a) => ({ ...a, icon: Save }))}
      />
    </EnterpriseBusinessFactBox>
  )

  return (
    <EnterpriseWorkspace
      badge={badge ?? 'Master Data'}
      title={title}
      description={subtitle}
      breadcrumbs={breadcrumbs}
      favoritePath={favoritePath}
      recordNo={recordNo ?? (title.startsWith('New ') ? 'New' : title)}
      status={isActive === undefined ? undefined : isActive ? 'Active' : 'Inactive'}
      statusTone={isActive === undefined ? undefined : isActive ? 'success' : 'warning'}
      createdDate={resolveRecordCreatedDate(auditView)}
      createdBy={resolveRecordCreatedBy(auditView, pendingAuditUserName)}
      modifiedDate={auditView.modifiedAt ? formatDateTime(auditView.modifiedAt) : undefined}
      modifiedBy={auditView.modifiedByName ?? undefined}
      documentStrip={composedStrip}
      commandBar={commandBar}
      factBox={factBox}
      footer={stickyFooter}
      showAi
      formId={formId}
      onSubmit={onSubmit}
      validationErrors={validationErrors}
      lockedReason={lockedReason}
      onSaveShortcut={onSaveShortcut}
      onSaveCloseShortcut={onSaveCloseShortcut}
      onSaveAndNewShortcut={onSaveAndNewShortcut}
      className="enterprise-workspace--dynamics-form masters-standard-form"
    >
      {group && GroupIcon ? (
        <span className={cn('masters-module-chip mb-3 inline-flex', GROUP_ACCENT_CLASS[group.accent])}>
          <GroupIcon className="h-3.5 w-3.5" aria-hidden />
          {group.title}
        </span>
      ) : null}
      <EnterpriseFormSectionNav
        sections={sectionNavItems}
        activeId={activeSection}
        onSelect={onSectionSelect}
        trailing={<FactBoxPaneAiToggle />}
      />
      <EnterpriseFormMetrics metrics={formMetrics} />
      {children}
    </EnterpriseWorkspace>
  )
}

export interface EnterpriseMasterDetailWorkspaceProps {
  title: string
  subtitle?: string
  listPath: string
  listLabel: string
  editPath?: string
  breadcrumbs: { label: string; to?: string }[]
  masterGroupId?: MasterCatalogGroupId
  favoritePath?: string
  recordNo?: string
  isActive?: boolean
  documentStrip: { label: string; value: string; highlight?: boolean }[]
  formMetrics?: EnterpriseFormMetric[]
  factBoxTitle?: string
  factBoxSummary: { label: string; value: string; highlight?: boolean }[]
  sectionNavItems?: EnterpriseFormSectionNavItem[]
  activeSection?: string
  onSectionSelect?: (id: string) => void
  headerBadges?: ReactNode
  extraCommandActions?: { id: string; label: string; icon?: typeof Pencil; onClick: () => void }[]
  children: ReactNode
}

/** SAP / BC Object Page — read-only master view with fact box and section nav */
export function EnterpriseMasterDetailWorkspace({
  title,
  subtitle,
  listPath,
  listLabel,
  editPath,
  breadcrumbs,
  masterGroupId,
  favoritePath,
  recordNo,
  isActive,
  documentStrip,
  formMetrics = [],
  factBoxTitle,
  factBoxSummary,
  sectionNavItems,
  activeSection = 'general',
  onSectionSelect,
  headerBadges,
  extraCommandActions,
  children,
}: EnterpriseMasterDetailWorkspaceProps) {
  const navigate = useNavigate()
  const group = masterGroupId ? getMasterGroupById(masterGroupId) : undefined
  const GroupIcon = group?.icon

  const factBox = (
    <EnterpriseBusinessFactBox title={factBoxTitle ?? 'Master insight'}>
      <EnterpriseFormContextPanel summaryTitle="Summary" actionsTitle="Record" summary={factBoxSummary} />
    </EnterpriseBusinessFactBox>
  )

  const commandBar = (
    <ErpCommandBar
      inline
      sticky={false}
      primaryAction={
        editPath
          ? { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(editPath) }
          : undefined
      }
      secondaryActions={[
        ...(extraCommandActions ?? []),
        { id: 'list', label: listLabel, icon: ArrowLeft, onClick: () => navigate(listPath) },
      ]}
    />
  )

  const sections = sectionNavItems ?? [{ id: 'general', label: 'General', icon: FileText, done: true }]

  return (
    <EnterpriseWorkspace
      badge="Master Data"
      title={title}
      description={subtitle}
      breadcrumbs={breadcrumbs}
      favoritePath={favoritePath ?? listPath}
      recordNo={recordNo ?? title}
      status={isActive === undefined ? undefined : isActive ? 'Active' : 'Inactive'}
      statusTone={isActive === undefined ? undefined : isActive ? 'success' : 'warning'}
      documentStrip={documentStrip}
      commandBar={commandBar}
      factBox={factBox}
      stickyFooter={false}
      showAi
      onSubmit={(e) => e.preventDefault()}
      className="enterprise-workspace--dynamics-form masters-standard-detail"
    >
      {group && GroupIcon ? (
        <span className={cn('masters-module-chip mb-3 inline-flex', GROUP_ACCENT_CLASS[group.accent])}>
          <GroupIcon className="h-3.5 w-3.5" aria-hidden />
          {group.title}
        </span>
      ) : null}
      {headerBadges ? <div className="mb-3 flex flex-wrap items-center gap-2">{headerBadges}</div> : null}
      <EnterpriseFormSectionNav
        sections={sections}
        activeId={activeSection}
        onSelect={onSectionSelect ?? (() => undefined)}
        trailing={<FactBoxPaneAiToggle />}
      />
      {formMetrics.length > 0 ? <EnterpriseFormMetrics metrics={formMetrics} /> : null}
      {children}
    </EnterpriseWorkspace>
  )
}

/** Read-only detail section — shown when section tab matches */
export function MasterDetailSection({
  sectionId,
  activeSection,
  title,
  subtitle,
  children,
}: {
  sectionId: string
  activeSection: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  if (activeSection !== sectionId) return null
  return (
    <ErpCardSection title={title} subtitle={subtitle} collapsible defaultOpen className="masters-standard-section mb-4">
      {children}
    </ErpCardSection>
  )
}

export interface StandardMasterFormShellProps {
  title: string
  subtitle?: string
  listPath: string
  breadcrumbs: { label: string; to?: string }[]
  masterGroupId?: MasterCatalogGroupId
  favoritePath?: string
  isEdit?: boolean
  isSubmitting?: boolean
  validationErrors?: string[]
  lockedReason?: string
  footerHint?: ReactNode
  recordNo?: string
  isActive?: boolean
  documentStrip: { label: string; value: string; highlight?: boolean }[]
  recordAudit?: RecordAuditView
  pendingAuditUserName?: string
  formMetrics?: EnterpriseFormMetric[]
  factBoxTitle?: string
  factBoxSummary: { label: string; value: string; highlight?: boolean }[]
  sectionNavItems?: EnterpriseFormSectionNavItem[]
  activeSection?: string
  onSectionSelect?: (id: string) => void
  onSave: () => void
  onSaveClose: () => void
  onSaveNew: () => void
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
  children: ReactNode
}

/** Full SAP / BC card form shell — used by FormLayout and complex master forms */
export function StandardMasterFormShell({
  title,
  subtitle,
  listPath,
  breadcrumbs,
  masterGroupId,
  favoritePath,
  isEdit,
  isSubmitting,
  validationErrors,
  lockedReason,
  footerHint,
  recordNo,
  isActive,
  documentStrip,
  recordAudit,
  pendingAuditUserName,
  formMetrics = [],
  factBoxTitle,
  factBoxSummary,
  sectionNavItems,
  activeSection = 'general',
  onSectionSelect,
  onSave,
  onSaveClose,
  onSaveNew,
  onCancel,
  onSubmit,
  children,
}: StandardMasterFormShellProps) {
  const sections = sectionNavItems ?? [{ id: 'general', label: 'General', icon: FileText, done: true }]

  return (
    <EnterpriseMasterWorkspace
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      masterGroupId={masterGroupId}
      favoritePath={favoritePath ?? listPath}
      recordNo={recordNo}
      isActive={isActive}
      documentStrip={documentStrip}
      recordAudit={recordAudit}
      pendingAuditUserName={pendingAuditUserName}
      validationErrors={validationErrors}
      lockedReason={lockedReason}
      onSubmit={onSubmit}
      onSaveShortcut={onSave}
      onSaveCloseShortcut={onSaveClose}
      onSaveAndNewShortcut={isEdit ? undefined : onSaveNew}
      sectionNavItems={sections}
      activeSection={activeSection}
      onSectionSelect={onSectionSelect ?? (() => undefined)}
      formMetrics={formMetrics}
      factBoxTitle={factBoxTitle}
      factBoxSummary={factBoxSummary}
      commandBar={(
        <MasterFormCommandBar
          listPath={listPath}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={onSave}
          onSaveClose={onSaveClose}
          onSaveNew={onSaveNew}
          onCancel={onCancel}
        />
      )}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          hint={footerHint}
          onSave={onSave}
          onSaveClose={onSaveClose}
          onSaveNew={onSaveNew}
          onCancel={onCancel}
        />
      )}
    >
      {children}
    </EnterpriseMasterWorkspace>
  )
}
