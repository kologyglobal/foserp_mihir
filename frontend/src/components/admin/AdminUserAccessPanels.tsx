import { useCallback, useEffect, useState } from 'react'
import { ErpButton } from '../erp/ErpButton'
import { FormField } from '../forms/FormField'
import { Select } from '../forms/Inputs'
import { SELECT_PLACEHOLDER } from '../forms/selectStandards'
import { Badge } from '../ui/Badge'
import { isApiMode } from '../../config/apiConfig'
import {
  assignAdminUserResponsibilityApi,
  fetchAdminResponsibilitiesApi,
  fetchAdminUserResponsibilitiesApi,
  fetchAdminUserScopesApi,
  removeAdminUserResponsibilityApi,
  replaceAdminUserScopesApi,
  type AdminResponsibility,
  type AdminUserDataScope,
  type AdminUserResponsibility,
} from '../../services/api/adminApi'
import { listOrgLegalEntities } from '../../services/api/organisationApi'
import { listBranches, listLegalEntities } from '../../services/bridges/financeApiBridge'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { useMasterStore } from '../../store/masterStore'

type Option = { id: string; label: string; legalEntityId?: string }

/**
 * Phase 6 — user data scopes + responsibility assignments.
 * Empty scope = unrestricted (fail-open). Effective Access explain stays Phase 7.
 */
export function AdminUserAccessPanels({ userId }: { userId: string }) {
  const canViewScope = canAdminPermission('scope.view') || canAdminPermission('user.view')
  const canManageScope = canAdminPermission('scope.manage') || canAdminPermission('user.update')
  const canViewResp = canAdminPermission('responsibility.view') || canAdminPermission('user.view')
  const canAssignResp = canAdminPermission('responsibility.update') || canAdminPermission('user.update')

  const [scope, setScope] = useState<AdminUserDataScope | null>(null)
  const [assignments, setAssignments] = useState<AdminUserResponsibility[]>([])
  const [catalog, setCatalog] = useState<AdminResponsibility[]>([])
  const [leOptions, setLeOptions] = useState<Option[]>([])
  const [branchOptions, setBranchOptions] = useState<Option[]>([])
  const [whOptions, setWhOptions] = useState<Option[]>([])
  const [selectedLe, setSelectedLe] = useState<string[]>([])
  const [defaultLe, setDefaultLe] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedWh, setSelectedWh] = useState<string[]>([])
  const [pendingRespId, setPendingRespId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadLookups = useCallback(async () => {
    if (isApiMode()) {
      const entities = await listOrgLegalEntities()
      setLeOptions(entities.map((e) => ({ id: e.id, label: `${e.code} — ${e.tradeName || e.legalName}` })))
      const branches = await listBranches()
      setBranchOptions(
        branches.map((b) => ({
          id: b.id,
          label: `${b.code} — ${b.name}`,
          legalEntityId: b.legalEntityId,
        })),
      )
    } else {
      const entities = await listLegalEntities()
      setLeOptions(entities.map((e) => ({ id: e.id, label: `${e.code} — ${e.displayName || e.legalName}` })))
      const branches = await listBranches()
      setBranchOptions(
        branches.map((b) => ({
          id: b.id,
          label: `${b.code} — ${b.name}`,
          legalEntityId: b.legalEntityId,
        })),
      )
    }
    const warehouses = useMasterStore.getState().warehouses.filter((w) => w.isActive)
    setWhOptions(warehouses.map((w) => ({ id: w.id, label: `${w.warehouseCode} — ${w.warehouseName}` })))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await loadLookups()
      if (isApiMode()) {
        if (canViewScope) {
          const res = await fetchAdminUserScopesApi(userId)
          setScope(res.data)
          setSelectedLe(res.data.legalEntities.map((x) => x.legalEntityId))
          setDefaultLe(res.data.legalEntities.find((x) => x.isDefault)?.legalEntityId ?? '')
          setSelectedBranches(res.data.branches.map((x) => x.branchId))
          setSelectedWh(res.data.warehouses.map((x) => x.warehouseId))
        }
        if (canViewResp) {
          const [respRes, cat] = await Promise.all([
            fetchAdminUserResponsibilitiesApi(userId),
            fetchAdminResponsibilitiesApi({ active: 'true' }),
          ])
          setAssignments(respRes.data)
          setCatalog(cat.filter((r) => r.isActive))
        }
      } else {
        setScope({ unrestricted: true, legalEntities: [], branches: [], warehouses: [] })
        setAssignments([])
        setCatalog([])
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [userId, canViewScope, canViewResp, loadLookups])

  useEffect(() => {
    void load()
  }, [load])

  function toggleId(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function saveScopes() {
    if (!canManageScope || !isApiMode()) {
      notify.success('Demo mode — scopes not persisted to API')
      return
    }
    setBusy(true)
    try {
      const res = await replaceAdminUserScopesApi(userId, {
        legalEntities: selectedLe.map((legalEntityId) => ({
          legalEntityId,
          isDefault: legalEntityId === defaultLe,
          accessLevel: 'TRANSACT',
        })),
        branchIds: selectedBranches,
        warehouseIds: selectedWh,
      })
      setScope(res.data)
      notify.success(res.data.unrestricted ? 'Scopes cleared (unrestricted)' : 'Scopes saved')
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function assignResp() {
    if (!pendingRespId || !canAssignResp) return
    setBusy(true)
    try {
      if (!isApiMode()) {
        notify.success('Demo assignment skipped')
        return
      }
      await assignAdminUserResponsibilityApi(userId, { responsibilityId: pendingRespId })
      setPendingRespId('')
      notify.success('Responsibility assigned')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeAssignment(id: string) {
    if (!canAssignResp) return
    setBusy(true)
    try {
      if (!isApiMode()) return
      await removeAdminUserResponsibilityApi(userId, id)
      notify.success('Assignment removed')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-erp-muted">Loading access panels…</p>
  }

  return (
    <div className="space-y-6">
      {canViewScope ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-erp-text">Data scopes</h3>
            {scope?.unrestricted ? <Badge color="gray">Unrestricted (fail-open)</Badge> : <Badge color="blue">Scoped</Badge>}
          </div>
          <p className="text-xs text-erp-muted">
            Empty selections = full tenant access. When Legal Entities are set, branches must belong to those entities.
            Module list filters opt into these helpers in later phases.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Legal entities">
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-erp-border p-2">
                {leOptions.length === 0 ? <p className="text-xs text-erp-muted">No companies found</p> : null}
                {leOptions.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedLe.includes(o.id)}
                      disabled={!canManageScope}
                      onChange={() => toggleId(selectedLe, o.id, setSelectedLe)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Branches">
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-erp-border p-2">
                {branchOptions.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(o.id)}
                      disabled={!canManageScope}
                      onChange={() => toggleId(selectedBranches, o.id, setSelectedBranches)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Warehouses">
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-erp-border p-2">
                {whOptions.length === 0 ? <p className="text-xs text-erp-muted">Hydrate masters for warehouse list</p> : null}
                {whOptions.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedWh.includes(o.id)}
                      disabled={!canManageScope}
                      onChange={() => toggleId(selectedWh, o.id, setSelectedWh)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </FormField>
          </div>
          {selectedLe.length > 0 ? (
            <FormField label="Default legal entity">
              <Select value={defaultLe} onChange={(e) => setDefaultLe(e.target.value)} disabled={!canManageScope}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {selectedLe.map((id) => {
                  const o = leOptions.find((x) => x.id === id)
                  return (
                    <option key={id} value={id}>
                      {o?.label ?? id}
                    </option>
                  )
                })}
              </Select>
            </FormField>
          ) : null}
          {canManageScope ? (
            <ErpButton size="sm" type="button" disabled={busy} onClick={() => void saveScopes()}>
              Save scopes
            </ErpButton>
          ) : null}
        </div>
      ) : null}

      {canViewResp ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-erp-text">Responsibilities</h3>
          <div className="flex flex-wrap gap-2">
            {assignments.length === 0 ? <p className="text-sm text-erp-muted">No responsibilities assigned.</p> : null}
            {assignments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-erp-badge-soft-info px-2.5 py-1 text-xs font-semibold erp-badge-soft-info"
              >
                {a.responsibility.name}
                {canAssignResp ? (
                  <button type="button" className="text-erp-muted hover:text-erp-danger-fg" onClick={() => void removeAssignment(a.id)}>
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          {canAssignResp ? (
            <div className="flex items-end gap-2">
              <div className="w-64">
                <Select value={pendingRespId} onChange={(e) => setPendingRespId(e.target.value)}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {catalog.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.module})
                    </option>
                  ))}
                </Select>
              </div>
              <ErpButton size="sm" type="button" disabled={!pendingRespId || busy} onClick={() => void assignResp()}>
                Assign
              </ErpButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
