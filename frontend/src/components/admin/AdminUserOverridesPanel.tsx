import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpButton } from '../erp/ErpButton'
import { FormField } from '../forms/FormField'
import { Input, Select } from '../forms/Inputs'
import { SELECT_PLACEHOLDER } from '../forms/selectStandards'
import { Badge } from '../ui/Badge'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminUserOverridesApi,
  removeAdminUserOverrideApi,
  upsertAdminUserOverrideApi,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { useAdminStore } from '../../store/adminStore'
import { canAdminPermission } from '../../utils/permissions'
import { adminPermissionDisplayLabel, adminModuleLabel } from './AdminPermissionMatrix'
import { appConfirm } from '../../store/confirmDialogStore'

type OverrideEffect = 'ALLOW' | 'DENY'
type RowEffect = 'INHERIT' | OverrideEffect

type OverrideRow = {
  permissionName: string
  module: string
  effect: OverrideEffect
  reason: string | null
}

/**
 * Exception matrix: INHERIT (role only) / ALLOW / DENY per permission.
 * API-backed; demo mode stores overrides in component state for walkthrough only.
 */
export function AdminUserOverridesPanel({ userId }: { userId: string }) {
  const canView = canAdminPermission('user.view')
  const canEdit = canAdminPermission('user.update')
  const catalog = useAdminStore((s) => s.permissionCatalog)
  const [rows, setRows] = useState<OverrideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [pickPermission, setPickPermission] = useState('')
  const [pickEffect, setPickEffect] = useState<OverrideEffect>('DENY')
  const [pickReason, setPickReason] = useState('')
  const [busy, setBusy] = useState(false)

  const byName = useMemo(() => new Map(rows.map((r) => [r.permissionName, r])), [rows])

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (!isApiMode()) {
        setRows((prev) => prev)
        return
      }
      const res = await fetchAdminUserOverridesApi(userId)
      setRows(res.data)
    } catch (err) {
      notify.error(formatApiError(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [userId, canView])

  useEffect(() => {
    void load()
  }, [load])

  async function setEffect(permissionName: string, effect: RowEffect, reason?: string | null) {
    if (!canEdit) return
    setBusy(true)
    try {
      const perm = catalog.find((p) => p.name === permissionName)
      if (effect === 'INHERIT') {
        if (isApiMode()) {
          await removeAdminUserOverrideApi(userId, permissionName)
          await load()
        } else {
          setRows((prev) => prev.filter((r) => r.permissionName !== permissionName))
        }
        notify.success(`Override cleared for ${permissionName}`)
      } else {
        if (isApiMode()) {
          await upsertAdminUserOverrideApi(userId, {
            permissionName,
            effect,
            reason: reason ?? null,
          })
          await load()
        } else {
          setRows((prev) => {
            const next = prev.filter((r) => r.permissionName !== permissionName)
            next.push({
              permissionName,
              module: perm?.module ?? 'other',
              effect,
              reason: reason ?? null,
            })
            return next
          })
        }
        notify.success(`${effect} set for ${permissionName}`)
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function addOverride() {
    if (!pickPermission) {
      notify.error('Select a permission')
      return
    }
    await setEffect(pickPermission, pickEffect, pickReason || null)
    setPickPermission('')
    setPickReason('')
  }

  const filteredRows = useMemo(() => {
    const s = filter.toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        r.permissionName.toLowerCase().includes(s) ||
        r.module.toLowerCase().includes(s) ||
        (r.reason ?? '').toLowerCase().includes(s),
    )
  }, [rows, filter])

  if (!canView) {
    return <p className="text-sm text-erp-muted">You need user.view to manage overrides.</p>
  }

  if (loading && isApiMode()) {
    return <p className="text-sm text-erp-muted">Loading overrides…</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-erp-muted">
        Default is <strong>INHERIT</strong> (roles only). <strong>ALLOW</strong> adds a grant;{' '}
        <strong>DENY</strong> always removes a role grant at API enforcement time.
        {!isApiMode() ? ' Demo mode keeps overrides in this session only.' : null}
      </p>

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
          <FormField label="Permission" className="min-w-[220px] flex-1">
            <Select value={pickPermission} onChange={(e) => setPickPermission(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {catalog.slice(0, 400).map((p) => (
                <option key={p.id} value={p.name}>
                  {adminPermissionDisplayLabel(p.name)} ({p.name})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Effect">
            <Select value={pickEffect} onChange={(e) => setPickEffect(e.target.value as OverrideEffect)}>
              <option value="DENY">DENY</option>
              <option value="ALLOW">ALLOW</option>
            </Select>
          </FormField>
          <FormField label="Reason" className="min-w-[160px] flex-1">
            <Input value={pickReason} onChange={(e) => setPickReason(e.target.value)} placeholder="Optional note" />
          </FormField>
          <ErpButton size="sm" type="button" disabled={busy || !pickPermission} onClick={() => void addOverride()}>
            Set override
          </ErpButton>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter overrides…"
          className="max-w-xs text-sm"
        />
        <Badge color="gray">{rows.length} override(s)</Badge>
      </div>

      {filteredRows.length === 0 ? (
        <p className="text-sm text-erp-muted">No user overrides — all access inherits from roles.</p>
      ) : (
        <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
          {filteredRows.map((r) => {
            const current: RowEffect = byName.has(r.permissionName) ? r.effect : 'INHERIT'
            return (
              <li key={r.permissionName} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-erp-text">
                    {adminPermissionDisplayLabel(r.permissionName)}
                  </p>
                  <p className="text-xs text-erp-muted">
                    {adminModuleLabel(r.module)} · {r.permissionName}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(['INHERIT', 'ALLOW', 'DENY'] as RowEffect[]).map((eff) => (
                    <button
                      key={eff}
                      type="button"
                      disabled={!canEdit || busy}
                      onClick={() => {
                        void (async () => {
                          if (eff === 'INHERIT' && current !== 'INHERIT') {
                            const ok = await appConfirm({
                              title: 'Clear override?',
                              description: `Return ${r.permissionName} to role-inherited access.`,
                            })
                            if (!ok) return
                          }
                          await setEffect(r.permissionName, eff)
                        })()
                      }}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        current === eff
                          ? eff === 'DENY'
                            ? 'bg-red-100 text-red-800'
                            : eff === 'ALLOW'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-800'
                          : 'bg-white text-erp-muted ring-1 ring-erp-border'
                      }`}
                    >
                      {eff}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
