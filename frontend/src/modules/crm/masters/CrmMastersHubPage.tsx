import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  Target,
  MapPin,
  GitBranch,
  Flag,
  AlertCircle,
  Handshake,
  Activity,
  XCircle,
  FileText,
  CreditCard,
  Truck,
  Shield,
  CheckSquare,
  FolderOpen,
  Bookmark,
  Settings2,
} from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { crmModuleBreadcrumbs } from '../../../utils/crmNavigation'
import { CRM_LINKED_MASTERS, CRM_MASTERS_CATALOG } from '../../../config/crmMastersCatalog'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import { useCrmStore } from '../../../store/crmStore'
import { useMasterStore } from '../../../store/masterStore'
import { cn } from '../../../utils/cn'

const GROUP_LABELS: Record<string, string> = {
  company: 'Company & Account',
  pipeline: 'Pipeline & Ownership',
  communication: 'Engagement',
  quotation: 'Quotation & Terms',
  governance: 'Governance & Documents',
}

const GROUP_ORDER = ['company', 'pipeline', 'communication', 'quotation', 'governance']

const ICONS: Record<string, typeof Building2> = {
  companies: Building2,
  contacts: Users,
  'lead-sources': Target,
  industries: Building2,
  designations: Users,
  departments: Users,
  territories: MapPin,
  'lead-stages': GitBranch,
  'lead-priorities': Flag,
  'lead-reasons': AlertCircle,
  'opportunity-stages': Handshake,
  'opportunity-priorities': Flag,
  'activity-types': Activity,
  'lost-reasons': XCircle,
  'quotation-templates': Bookmark,
  'commercial-terms': FileText,
  'payment-terms': CreditCard,
  'delivery-terms': Truck,
  'warranty-terms': Shield,
  'approval-rules': CheckSquare,
  'document-types': FolderOpen,
}

function MasterCard({
  title,
  description,
  to,
  count,
  icon: Icon,
}: {
  title: string
  description: string
  to: string
  count?: number
  icon: typeof Building2
}) {
  return (
    <Link
      to={to}
      className="crm-masters-card group block rounded-lg border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)] transition hover:border-erp-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="crm-masters-card__icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-erp-primary-soft text-erp-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-erp-text group-hover:text-erp-primary">{title}</h3>
            {typeof count === 'number' ? (
              <span className="shrink-0 rounded-full bg-erp-surface-alt px-2 py-0.5 text-[11px] font-semibold text-erp-muted">
                {count}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-erp-muted">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export function CrmMastersHubPage() {
  const navigate = useNavigate()
  const entries = useCrmMasterStore((s) => s.entries)
  const customers = useMasterStore((s) => s.customers)
  const contacts = useCrmStore((s) => s.contacts)
  const templates = useCrmStore((s) => s.quotationTemplates)
  const activeCount = entries.filter((e) => e.status === 'active').length

  const linkedCounts: Record<string, number> = {
    companies: customers.length,
    contacts: contacts.length,
    'quotation-templates': templates.length,
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: [
      ...CRM_LINKED_MASTERS.filter((m) => m.group === group).map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        to: m.listRoute,
        count: linkedCounts[m.slug],
      })),
      ...CRM_MASTERS_CATALOG.filter((m) => m.group === group).map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        to: `/crm/masters/${m.slug}`,
        count: entries.filter((e) => e.kind === m.kind).length,
      })),
    ],
  }))

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM"
      title="CRM Masters"
      description="Setup and configuration for CRM dropdowns, stages, terms, and reference data."
      breadcrumbs={crmModuleBreadcrumbs('CRM Masters', '/crm/masters')}
      autoBreadcrumbs={false}
      favoritePath="/crm/masters"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'crm-masters-guide',
            label: 'Master Setup Guide',
            icon: Settings2,
            onClick: () => document.getElementById('crm-masters-setup-guide')?.scrollIntoView({ behavior: 'smooth' }),
          }}
          secondaryActions={[
            { id: 'companies', label: 'Company Master', onClick: () => navigate('/masters/companies') },
            { id: 'lead-stages', label: 'Lead Stages', onClick: () => navigate('/crm/masters/lead-stages') },
          ]}
        />
      )}
      insights={[
        { label: 'Master Registers', value: CRM_MASTERS_CATALOG.length + CRM_LINKED_MASTERS.length, accent: 'blue' },
        { label: 'Active Values', value: activeCount, accent: 'green' },
        { label: 'Linked Pages', value: CRM_LINKED_MASTERS.length, accent: 'slate' },
        { label: 'Import / Export', value: CRM_MASTERS_CATALOG.filter((m) => m.importExport).length, accent: 'amber' },
      ]}
    >
      <div className="crm-masters-hub space-y-8">
        {grouped.map(({ group, label, items }) =>
          items.length > 0 ? (
            <section key={group}>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">{label}</h2>
              <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3')}>
                {items.map((item) => (
                  <MasterCard
                    key={item.slug}
                    title={item.title}
                    description={item.description}
                    to={item.to}
                    count={item.count}
                    icon={ICONS[item.slug] ?? Settings2}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        <section id="crm-masters-setup-guide" className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-5">
          <h2 className="text-[14px] font-semibold text-erp-text">Master Setup Guide</h2>
          <p className="mt-2 text-[13px] text-erp-muted">
            Configure reference data before go-live: territories first, then pipeline stages, quotation terms, and approval rules. Maintain CRM users under Master Data → User Management.
            Every register supports search, filters, CSV import/export, audit history, and usage tracking.
          </p>
        </section>
      </div>
    </OperationalPageShell>
  )
}
