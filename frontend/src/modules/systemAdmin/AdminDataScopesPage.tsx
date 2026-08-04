import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { DATA_ACCESS_LEVELS } from '@/config/adminAccessWorkspace'
import { useAdminStore } from '@/store/adminStore'
import { isApiMode } from '@/config/apiConfig'
import { ErpCardSection } from '@/components/erp/card-form'
import { Badge } from '@/components/ui/Badge'
import { AdminUserAccessPanels } from '@/components/admin'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { patchAdminUserDataAccessLevelApi } from '@/services/api/adminApi'
import { notify } from '@/store/toastStore'
import { formatApiError } from '@/services/api/apiErrors'
import { canAdminPermission } from '@/utils/permissions'

export function AdminDataScopesPage() {
  const users = useAdminStore((s) => s.users)
  const canManage = canAdminPermission('scope.manage') || canAdminPermission('user.update')
  const [userId, setUserId] = useState('')
  const [level, setLevel] = useState('ALL')

  useEffect(() => {
    if (!userId && users[0]) setUserId(users[0].id)
  }, [users, userId])

  const selected = users.find((u) => u.id === userId)

  const saveLevel = useCallback(async () => {
    if (!userId) return
    try {
      if (isApiMode()) {
        await patchAdminUserDataAccessLevelApi(userId, level)
        notify.success('Data access level updated')
      } else {
        notify.success('Demo: data access level saved locally (re-open after API wire for full persist)')
      }
    } catch (e) {
      notify.error(formatApiError(e))
    }
  }, [userId, level])

  return (
    <AdminWorkspaceShell
      title="Data Scopes"
      description="Own / Team / Department / Branch / Legal Entity / Warehouse / All — plus org membership grants."
      workspace="people"
      favoritePath="/admin/data-scopes"
    >
      <div className="space-y-4">
        <ErpCardSection id="scope-legend" title="Visibility levels" defaultOpen>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DATA_ACCESS_LEVELS.map((d) => (
              <div key={d.id} className="rounded-lg border border-erp-border bg-white px-3 py-2">
                <div className="text-sm font-semibold text-erp-text">{d.label}</div>
                <div className="text-xs text-erp-muted">{d.description}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-erp-muted">
            Empty LE/branch/warehouse membership remains fail-open unrestricted for org units (existing behaviour). Prefer
            assigning warehouses for Storekeeper personas.
          </p>
        </ErpCardSection>

        <ErpCardSection id="scope-user" title="Edit user scope" defaultOpen>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-erp-muted">User</span>
              <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="min-w-[16rem]">
                <option value="">{SELECT_PLACEHOLDER}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} · {u.email}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-erp-muted">Data access level</span>
              <Select value={level} onChange={(e) => setLevel(e.target.value)} className="min-w-[12rem]">
                {DATA_ACCESS_LEVELS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </label>
            <button
              type="button"
              disabled={!canManage || !userId}
              className="rounded-md bg-erp-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              onClick={() => void saveLevel()}
            >
              Save level
            </button>
            {selected ? (
              <Link to={`/admin/users/${selected.id}`} className="text-xs font-semibold text-erp-primary">
                Open user detail →
              </Link>
            ) : null}
          </div>
          {userId ? (
            <div className="mt-4">
              <AdminUserAccessPanels userId={userId} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-erp-muted">Select a user to manage company / branch / warehouse membership.</p>
          )}
        </ErpCardSection>

        <ErpCardSection id="scope-examples" title="Recommended persona scopes" defaultOpen={false}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-erp-text">
            <li>
              Sales Executive → <Badge color="blue">OWN</Badge> CRM
            </li>
            <li>
              Sales Manager → <Badge color="blue">TEAM</Badge>
            </li>
            <li>
              Purchase Manager → <Badge color="blue">BRANCH</Badge>
            </li>
            <li>
              Storekeeper → <Badge color="blue">WAREHOUSE</Badge> (assign warehouses)
            </li>
            <li>
              CEO → <Badge color="blue">ALL</Badge> mostly view/approve
            </li>
          </ul>
        </ErpCardSection>
      </div>
    </AdminWorkspaceShell>
  )
}
