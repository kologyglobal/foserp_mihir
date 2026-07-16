import { createContext, useContext, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ErpCardSection } from '../erp/card-form'
import { OperationalPageShell } from '../design-system/OperationalPageShell'
import type { MasterCatalogGroupId } from '../../config/mastersSetupCatalog'
import { buildMasterBreadcrumbs } from '../../utils/masterNavigation'
import type { EnterpriseFormMetric, EnterpriseFormSectionNavItem } from '../../design-system/workspace'
import {
  EnterpriseMasterDetailWorkspace,
  MasterDetailSection,
  StandardMasterFormShell,
} from '../../modules/masters/shared/EnterpriseMasterShell'

const MasterDetailSectionContext = createContext('general')

export function useMasterDetailActiveSection() {
  return useContext(MasterDetailSectionContext)
}

interface DetailLayoutProps {
  backTo: string
  backLabel: string
  title: string
  subtitle?: string
  editTo?: string
  editLabel?: string
  headerActions?: React.ReactNode
  badges?: React.ReactNode
  breadcrumbs?: { label: string; to?: string }[]
  masterGroupId?: MasterCatalogGroupId
  favoritePath?: string
  recordNo?: string
  isActive?: boolean
  documentStrip?: { label: string; value: string; highlight?: boolean }[]
  formMetrics?: EnterpriseFormMetric[]
  factBoxTitle?: string
  factBoxSummary?: { label: string; value: string; highlight?: boolean }[]
  sectionNavItems?: EnterpriseFormSectionNavItem[]
  extraCommandActions?: { id: string; label: string; icon?: LucideIcon; onClick: () => void }[]
  children: React.ReactNode
}

export function MasterNotFound({ message = 'Record not found.' }: { message?: string }) {
  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Master Data"
      title="Record not found"
      breadcrumbs={[{ label: 'Master Data', to: '/masters' }, { label: 'Not found' }]}
      autoBreadcrumbs={false}
    >
      <div className="masters-empty-state flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-erp-text">{message}</p>
        <Link to="/masters" className="text-sm font-semibold text-erp-primary hover:underline">
          Back to Master Data Hub
        </Link>
      </div>
    </OperationalPageShell>
  )
}

export function DetailLayout({
  backTo,
  backLabel,
  title,
  subtitle,
  editTo,
  badges,
  breadcrumbs,
  masterGroupId,
  favoritePath,
  recordNo,
  isActive,
  documentStrip,
  formMetrics,
  factBoxTitle,
  factBoxSummary,
  sectionNavItems,
  extraCommandActions,
  children,
}: DetailLayoutProps) {
  const [activeSection, setActiveSection] = useState(sectionNavItems?.[0]?.id ?? 'general')
  const crumbs =
    breadcrumbs ??
    (masterGroupId ? buildMasterBreadcrumbs(masterGroupId, title) : [{ label: backLabel, to: backTo }, { label: title }])

  return (
    <EnterpriseMasterDetailWorkspace
      title={title}
      subtitle={subtitle}
      listPath={backTo}
      listLabel={backLabel}
      editPath={editTo}
      breadcrumbs={crumbs}
      masterGroupId={masterGroupId}
      favoritePath={favoritePath ?? backTo}
      recordNo={recordNo ?? subtitle ?? title}
      isActive={isActive}
      documentStrip={
        documentStrip ?? [
          { label: 'Record', value: recordNo ?? title, highlight: true },
          ...(isActive !== undefined
            ? [{ label: 'Status', value: isActive ? 'Active' : 'Inactive' }]
            : []),
        ]
      }
      formMetrics={formMetrics}
      factBoxTitle={factBoxTitle}
      factBoxSummary={
        factBoxSummary ?? [
          { label: 'Register', value: backLabel.replace(/^Back to /i, '') },
          { label: 'Code', value: recordNo ?? subtitle ?? '—' },
        ]
      }
      sectionNavItems={sectionNavItems}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      headerBadges={badges}
      extraCommandActions={extraCommandActions}
    >
      <MasterDetailSectionContext.Provider value={activeSection}>
        {children}
      </MasterDetailSectionContext.Provider>
    </EnterpriseMasterDetailWorkspace>
  )
}

export function DetailSection({
  title,
  subtitle,
  sectionId = 'general',
  activeSection: activeSectionProp,
  children,
}: {
  title: string
  subtitle?: string
  sectionId?: string
  activeSection?: string
  children: React.ReactNode
}) {
  const activeFromContext = useMasterDetailActiveSection()
  const activeSection = activeSectionProp ?? activeFromContext

  return (
    <MasterDetailSection sectionId={sectionId} activeSection={activeSection} title={title} subtitle={subtitle}>
      {children}
    </MasterDetailSection>
  )
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="masters-detail-grid grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  )
}

export function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="masters-detail-field">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-1 text-[13px] font-medium text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function FormLayout({
  title,
  subtitle,
  backTo,
  backLabel,
  onSubmit,
  isSubmitting,
  children,
  validationErrors,
  lockedReason,
  footerHint,
  breadcrumbs,
  masterGroupId,
  favoritePath,
  isEdit,
  recordNo,
  isActive,
  documentStrip,
  formMetrics,
  factBoxTitle,
  factBoxSummary,
  sectionNavItems,
  onSave,
  onSaveClose,
  onSaveNew,
  onCancel,
}: {
  title: string
  subtitle?: string
  backTo: string
  backLabel: string
  onSubmit: (e: FormEvent) => void
  isSubmitting?: boolean
  submitLabel?: string
  children: React.ReactNode
  validationErrors?: string[]
  lockedReason?: string
  footerHint?: React.ReactNode
  breadcrumbs?: { label: string; to?: string }[]
  masterGroupId?: MasterCatalogGroupId
  favoritePath?: string
  isEdit?: boolean
  recordNo?: string
  isActive?: boolean
  documentStrip?: { label: string; value: string; highlight?: boolean }[]
  formMetrics?: EnterpriseFormMetric[]
  factBoxTitle?: string
  factBoxSummary?: { label: string; value: string; highlight?: boolean }[]
  sectionNavItems?: EnterpriseFormSectionNavItem[]
  onSave?: () => void
  onSaveClose?: () => void
  onSaveNew?: () => void
  onCancel?: () => void
}) {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(sectionNavItems?.[0]?.id ?? 'general')
  const submitForm = () => (document.getElementById('master-standard-form') as HTMLFormElement | null)?.requestSubmit()
  const resolvedBreadcrumbs =
    breadcrumbs ??
    (masterGroupId ? buildMasterBreadcrumbs(masterGroupId, title) : [{ label: backLabel, to: backTo }, { label: title }])

  const handleSave = onSave ?? submitForm
  const handleSaveClose = onSaveClose ?? (() => { handleSave(); navigate(backTo) })
  const handleSaveNew = onSaveNew ?? handleSave
  const handleCancel = onCancel ?? (() => navigate(backTo))

  return (
    <StandardMasterFormShell
      title={title}
      subtitle={subtitle}
      listPath={backTo}
      breadcrumbs={resolvedBreadcrumbs}
      masterGroupId={masterGroupId}
      favoritePath={favoritePath}
      isEdit={isEdit}
      isSubmitting={isSubmitting}
      validationErrors={validationErrors}
      lockedReason={lockedReason}
      footerHint={footerHint}
      recordNo={recordNo}
      isActive={isActive}
      documentStrip={documentStrip ?? [{ label: 'Record', value: title, highlight: true }]}
      formMetrics={formMetrics}
      factBoxTitle={factBoxTitle}
      factBoxSummary={factBoxSummary ?? [{ label: 'Register', value: backLabel.replace(/^Back to /i, '') }]}
      sectionNavItems={sectionNavItems}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      onSave={handleSave}
      onSaveClose={handleSaveClose}
      onSaveNew={handleSaveNew}
      onCancel={handleCancel}
      onSubmit={onSubmit}
    >
      {activeSection === 'general' || !sectionNavItems ? children : null}
    </StandardMasterFormShell>
  )
}

export function FormSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <ErpCardSection title={title} subtitle={subtitle} className={className} collapsible defaultOpen>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </ErpCardSection>
  )
}
