import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { activateProfile, deactivateProfile, deleteProfile, listProfiles } from '@/services/api/manufacturingApi'
import { useSetupLookup } from './useSetupLookups'
import type { Profile } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

export function ProfilesSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Profile[]>([])
  const { options: items } = useSetupLookup('items')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const itemLabel = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      return item?.label ?? '—'
    },
    [items],
  )

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listProfiles({ search: search || undefined, limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load profiles')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const toggleActive = async (row: Profile) => {
    setBusyId(row.id)
    try {
      if (row.isActive) {
        await deactivateProfile(row.id)
        notify.success('Profile deactivated.')
      } else {
        await activateProfile(row.id)
        notify.success('Profile activated.')
      }
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (row: Profile) => {
    const ok = await appConfirm({
      title: 'Delete profile?',
      description: `Delete ${row.code}? This soft-deletes the profile.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteProfile(row.id)
      notify.success('Profile deleted.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <ManufacturingSetupShell
      title="Manufacturing Profiles"
      actions={
        apiMode && perms.canManageProfile ? (
          <ErpButton size="sm" onClick={() => navigate('/manufacturing/profiles/new')}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Profile
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup && !perms.canViewProfile ? (
        <EmptyState icon={SlidersHorizontal} title="Access denied" description="Missing profile view permission." />
      ) : (
        <>
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={6} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState icon={SlidersHorizontal} title="No profiles found" description="Create a manufacturing profile for an item." />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[760px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Item</th>
                    <th>Production Type</th>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-[11px] font-medium">{row.code}</td>
                      <td className="font-medium">{row.name}</td>
                      <td>{itemLabel(row.productItemId)}</td>
                      <td>{row.productionType.replace(/_/g, ' ')}</td>
                      <td>{row.executionMode}</td>
                      <td>
                        <DynamicsStatusChip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={row.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/profiles/${row.id}`)}>
                            View
                          </ErpButton>
                          {perms.canManageProfile ? (
                            <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/profiles/${row.id}/edit`)}>
                              Edit
                            </ErpButton>
                          ) : null}
                          {perms.canManageProfile ? (
                            <ErpButton
                              size="sm"
                              variant="outline"
                              loading={busyId === row.id}
                              onClick={() => void toggleActive(row)}
                            >
                              {row.isActive ? 'Deactivate' : 'Activate'}
                            </ErpButton>
                          ) : null}
                          {perms.canManageProfile ? (
                            <ErpButton
                              size="sm"
                              variant="outline"
                              loading={busyId === row.id}
                              onClick={() => void remove(row)}
                            >
                              Delete
                            </ErpButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </ManufacturingSetupShell>
  )
}
