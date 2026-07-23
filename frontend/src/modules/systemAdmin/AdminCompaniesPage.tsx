import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, FileText, BookOpen, CalendarRange, Network, RefreshCw } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminNeedsAttention,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  type AdminAttentionItem,
} from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { Badge } from '../../components/ui/Badge'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { listOrgLegalEntities, type OrgLegalEntity } from '../../services/api/organisationApi'
import { listLegalEntities } from '../../services/bridges/financeApiBridge'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { useOrganisationPermissions } from '../../utils/permissions/organisation'
import { ORGANISATION_SETUP_NAV } from '../../config/organisationSetupNav'

/**
 * Admin Companies entry — LegalEntity SoT via organisation / finance APIs.
 * Full create/edit lives in Organisation Setup; this page is the Admin hub.
 */
export function AdminCompaniesPage() {
  const navigate = useNavigate()
  const perms = useOrganisationPermissions()
  const [rows, setRows] = useState<OrgLegalEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiMode()) {
        setRows(await listOrgLegalEntities())
      } else {
        const entities = await listLegalEntities()
        setRows(
          entities.map((e) => ({
            id: e.id,
            tenantId: e.tenantId ?? '',
            code: e.code,
            legalName: e.legalName,
            tradeName: e.displayName ?? e.legalName,
            businessType: e.entityType,
            gstNumber: e.gstin ?? null,
            pan: e.pan ?? null,
            country: e.countryCode === 'IN' ? 'India' : (e.countryCode || 'India'),
            state: '',
            district: null,
            city: '',
            postalCode: '',
            addressLine: '',
            status: (e.isActive ? 'ACTIVE' : 'INACTIVE') as 'ACTIVE' | 'INACTIVE',
            isDefault: e.isDefault,
            fiscalYearStartMonth: e.fiscalYearStartMonth,
            createdAt: e.createdAt ?? '',
            updatedAt: e.updatedAt ?? '',
          })),
        )
      }
    } catch (err) {
      const msg = formatApiError(err)
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
    else setLoading(false)
  }, [load, perms.canView])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'ACTIVE').length
    const withGst = rows.filter((r) => Boolean(r.gstNumber)).length
    const defaults = rows.filter((r) => r.isDefault).length
    return { total: rows.length, active, withGst, defaults }
  }, [rows])

  const attention = useMemo((): AdminAttentionItem[] => {
    const items: AdminAttentionItem[] = []
    if (rows.length === 0) {
      items.push({
        id: 'no-le',
        title: 'No legal entity configured',
        detail: 'Create the primary company under Organisation Setup before posting finance or tax documents.',
        severity: 'critical',
        to: '/settings/organisation/legal-entity',
      })
    }
    if (rows.length > 0 && stats.defaults === 0) {
      items.push({
        id: 'no-default',
        title: 'No default legal entity',
        detail: 'Mark one entity as default for finance context switching.',
        severity: 'warning',
        to: '/settings/organisation/legal-entity',
      })
    }
    if (rows.length > 0 && stats.withGst < rows.length) {
      items.push({
        id: 'gst',
        title: 'Some entities are missing GSTIN',
        detail: 'Add GST on the legal entity or under Registration Details.',
        severity: 'info',
        to: '/settings/organisation/registrations',
      })
    }
    return items
  }, [rows, stats])

  return (
    <AdminWorkspaceShell
      title="Companies"
      description="Legal entities for this workspace — same data as Organisation Setup."
      workspace="organization"
      favoritePath="/admin/companies"
      pageGuide={{
        purpose: 'Admin entry for companies (Legal Entities). SoT is organisation / accounting APIs.',
        nextStep: 'Open Organisation Setup to create or edit an entity, registrations, CoA, and fiscal calendar.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'org-setup',
            label: perms.canCreate ? 'Manage in Organisation Setup' : 'Open Organisation Setup',
            icon: Building2,
            onClick: () => navigate('/settings/organisation/legal-entity'),
          }}
          secondaryActions={[
            {
              id: 'branches',
              label: 'Branches',
              icon: Network,
              onClick: () => navigate('/admin/branches'),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        {!perms.canView ? (
          <AdminEmptyState
            title="No access"
            description="You need organisation.view or finance legal-entity view to list companies."
          />
        ) : loading ? (
          <AdminSkeleton rows={5} />
        ) : error ? (
          <AdminErrorState title="Could not load companies" description={error} />
        ) : (
          <>
            <AdminSummaryStrip>
              <AdminSummaryCard label="Legal entities" value={stats.total} icon={Building2} accent="blue" />
              <AdminSummaryCard label="Active" value={stats.active} accent="green" />
              <AdminSummaryCard label="With GSTIN" value={stats.withGst} accent="amber" />
              <AdminSummaryCard label="Default" value={stats.defaults} accent="slate" />
            </AdminSummaryStrip>

            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <AdminNeedsAttention items={attention} title="Company setup" />

                <section className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
                  <header className="border-b border-erp-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-erp-text">Legal entities</h2>
                    <p className="text-xs text-erp-muted">Source: organisation legal-entities API</p>
                  </header>
                  {rows.length === 0 ? (
                    <AdminEmptyState
                      title="No companies yet"
                      description="Create the first legal entity in Organisation Setup."
                      action={
                        <ErpButton size="sm" type="button" onClick={() => navigate('/settings/organisation/legal-entity')}>
                          Open Organisation Setup
                        </ErpButton>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-erp-surface-alt text-xs uppercase tracking-wide text-erp-muted">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Code</th>
                            <th className="px-4 py-2 font-semibold">Legal name</th>
                            <th className="px-4 py-2 font-semibold">Trade name</th>
                            <th className="px-4 py-2 font-semibold">GSTIN</th>
                            <th className="px-4 py-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-erp-border">
                          {rows.map((row) => (
                            <tr
                              key={row.id}
                              className="cursor-pointer hover:bg-erp-surface-alt/60"
                              onClick={() => navigate('/settings/organisation/legal-entity')}
                            >
                              <td className="px-4 py-2.5 font-mono text-xs">{row.code}</td>
                              <td className="px-4 py-2.5 font-medium text-erp-text">
                                {row.legalName}
                                {row.isDefault ? (
                                  <Badge color="blue" className="ml-2">
                                    Default
                                  </Badge>
                                ) : null}
                              </td>
                              <td className="px-4 py-2.5 text-erp-muted">{row.tradeName}</td>
                              <td className="px-4 py-2.5 font-mono text-xs">{row.gstNumber ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <Badge color={row.status === 'ACTIVE' ? 'green' : 'gray'}>{row.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-3">
                <section className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-erp-text">Organisation setup</h2>
                  <p className="mt-0.5 text-xs text-erp-muted">Deep links to the same SoT workspace.</p>
                  <ul className="mt-3 space-y-1">
                    {ORGANISATION_SETUP_NAV.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-erp-text hover:bg-erp-surface-alt"
                          onClick={() => navigate(item.path)}
                        >
                          <item.icon className="h-4 w-4 text-erp-muted" strokeWidth={1.75} />
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-xl border border-dashed border-erp-border bg-erp-surface-alt/40 p-4 text-xs text-erp-muted">
                  <p className="font-medium text-erp-text">Not a second company master</p>
                  <p className="mt-1">
                    Books, GST, and fiscal calendar stay on LegalEntity. Admin Companies is the entry point only.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Registrations
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> CoA
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange className="h-3 w-3" /> FY / Periods
                    </span>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  )
}
