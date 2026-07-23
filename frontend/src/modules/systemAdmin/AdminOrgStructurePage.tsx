import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, FolderTree, Network, RefreshCw, Warehouse } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminNeedsAttention,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  type AdminAttentionItem,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { listOrgLegalEntities, type OrgLegalEntity } from '../../services/api/organisationApi'
import { fetchAdminDepartmentsApi } from '../../services/api/adminApi'
import { listBranches, listLegalEntities } from '../../services/bridges/financeApiBridge'
import type { Branch } from '../../types/financeSetup'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { useOrganisationPermissions } from '../../utils/permissions/organisation'
import { canAdminPermission } from '../../utils/permissions'

/**
 * Read-only org structure: Legal Entity → Branches.
 * Departments and warehouses are sibling panels (no fake LE hierarchy).
 */
export function AdminOrgStructurePage() {
  const navigate = useNavigate()
  const orgPerms = useOrganisationPermissions()
  const canViewDept = canAdminPermission('department.view') || canAdminPermission('user.view')
  const [entities, setEntities] = useState<OrgLegalEntity[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [deptCount, setDeptCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiMode()) {
        const [le, br] = await Promise.all([listOrgLegalEntities(), listBranches()])
        setEntities(le)
        setBranches(br)
        if (canViewDept) {
          const deps = await fetchAdminDepartmentsApi({ active: 'all' })
          setDeptCount(deps.length)
        } else {
          setDeptCount(0)
        }
      } else {
        const le = await listLegalEntities()
        setEntities(
          le.map((e) => ({
            id: e.id,
            tenantId: e.tenantId ?? '',
            code: e.code,
            legalName: e.legalName,
            tradeName: e.displayName ?? e.legalName,
            businessType: e.entityType,
            gstNumber: e.gstin ?? null,
            pan: e.pan ?? null,
            country: e.countryCode === 'IN' ? 'India' : e.countryCode || 'India',
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
        setBranches(await listBranches())
        setDeptCount(0)
      }
    } catch (err) {
      const msg = formatApiError(err)
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [canViewDept])

  useEffect(() => {
    if (orgPerms.canView) void load()
    else setLoading(false)
  }, [load, orgPerms.canView])

  const tree = useMemo(() => {
    return entities.map((le) => ({
      entity: le,
      branches: branches.filter((b) => b.legalEntityId === le.id),
    }))
  }, [entities, branches])

  const orphanBranches = useMemo(
    () => branches.filter((b) => !entities.some((e) => e.id === b.legalEntityId)),
    [branches, entities],
  )

  const attention = useMemo((): AdminAttentionItem[] => {
    const items: AdminAttentionItem[] = []
    if (entities.length === 0) {
      items.push({
        id: 'no-le',
        title: 'No legal entity configured',
        detail: 'Create a company under Organisation Setup before mapping branches.',
        severity: 'critical',
        to: '/settings/organisation/legal-entity',
      })
    }
    return items
  }, [entities])

  return (
    <AdminWorkspaceShell
      title="Organization Structure"
      description="Read-only view of legal entities and their branches. Departments and warehouses stay as linked masters."
      workspace="organization"
      favoritePath="/admin/org-structure"
      pageGuide={{
        purpose: 'Visual map of Legal Entity → Branch. Does not invent Department/Warehouse under LE.',
        nextStep: 'Open Companies or Branches to manage masters; assign warehouses under Inventory masters.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'companies',
            label: 'Companies',
            icon: Building2,
            onClick: () => navigate('/admin/companies'),
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
        {!orgPerms.canView ? (
          <AdminEmptyState title="No access" description="You need organisation.view to open Organization Structure." />
        ) : loading ? (
          <AdminSkeleton rows={5} />
        ) : error ? (
          <AdminErrorState title="Could not load org structure" description={error} />
        ) : (
          <>
            <AdminSummaryStrip>
              <AdminSummaryCard label="Legal entities" value={entities.length} accent="blue" to="/admin/companies" />
              <AdminSummaryCard label="Branches" value={branches.length} to="/admin/branches" />
              <AdminSummaryCard label="Departments" value={deptCount} to="/admin/departments" />
            </AdminSummaryStrip>

            <AdminNeedsAttention items={attention} />

            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <ErpCardSection title="Legal entities → Branches">
                {tree.length === 0 ? (
                  <AdminEmptyState
                    title="Nothing to show"
                    description="Add a legal entity, then create branches under Accounting settings."
                  />
                ) : (
                  <ul className="space-y-4">
                    {tree.map(({ entity, branches: kids }) => (
                      <li key={entity.id} className="rounded-lg border border-erp-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="h-4 w-4 text-erp-primary" />
                          <Link to="/admin/companies" className="font-medium text-erp-text hover:underline">
                            {entity.legalName}
                          </Link>
                          <span className="text-xs text-erp-muted">{entity.code}</span>
                          <Badge color={entity.status === 'ACTIVE' ? 'green' : 'gray'}>{entity.status}</Badge>
                          {entity.isDefault ? <Badge color="blue">Default</Badge> : null}
                        </div>
                        {kids.length === 0 ? (
                          <p className="mt-2 text-xs text-erp-muted">No branches under this entity.</p>
                        ) : (
                          <ul className="mt-2 space-y-1 border-l border-erp-border pl-4">
                            {kids.map((b) => (
                              <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                                <Network className="h-3.5 w-3.5 text-erp-muted" />
                                <span className="text-erp-text">{b.name}</span>
                                <span className="text-xs text-erp-muted">{b.code}</span>
                                <Badge color={b.isActive ? 'green' : 'gray'}>{b.branchType}</Badge>
                                {b.isDefault ? <Badge color="blue">Default</Badge> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                    {orphanBranches.length > 0 ? (
                      <li className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                        <p className="text-sm font-medium text-erp-text">Branches without matching LE</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {orphanBranches.map((b) => (
                            <li key={b.id}>
                              {b.name} ({b.code})
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                  </ul>
                )}
              </ErpCardSection>

              <div className="space-y-3">
                <ErpCardSection title="Departments">
                  <div className="flex items-start gap-2">
                    <FolderTree className="mt-0.5 h-4 w-4 text-erp-muted" />
                    <div>
                      <p className="text-sm text-erp-text">{deptCount} department{deptCount === 1 ? '' : 's'}</p>
                      <p className="text-xs text-erp-muted">IAM people org units — not nested under LE.</p>
                      <Link to="/admin/departments" className="mt-2 inline-block text-xs text-erp-primary hover:underline">
                        Manage departments
                      </Link>
                    </div>
                  </div>
                </ErpCardSection>
                <ErpCardSection title="Warehouses">
                  <div className="flex items-start gap-2">
                    <Warehouse className="mt-0.5 h-4 w-4 text-erp-muted" />
                    <div>
                      <p className="text-sm text-erp-text">Inventory masters</p>
                      <p className="text-xs text-erp-muted">Warehouses link to plants, not Legal Entity.</p>
                      <Link to="/masters/warehouses" className="mt-2 inline-block text-xs text-erp-primary hover:underline">
                        Open warehouses
                      </Link>
                    </div>
                  </div>
                </ErpCardSection>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  )
}
