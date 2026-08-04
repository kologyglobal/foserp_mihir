import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Shield } from 'lucide-react'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/forms/Inputs'
import { useAdminStore } from '@/store/adminStore'
import { isApiMode } from '@/config/apiConfig'
import { fetchAdminPermissionCatalogApi } from '@/services/api/adminApi'
import {
  ACCESS_MATRIX_ROWS,
  ACCESS_PRESETS,
  MATRIX_ACTIONS,
  applyPresetToSelected,
  detectSodWarnings,
  resolveCellPermissions,
  type AccessPresetId,
  type MatrixArea,
} from '@/config/adminAccessWorkspace'
import { cn } from '@/utils/cn'
import { notify } from '@/store/toastStore'

export function AdminPermissionMatrixPage() {
  const catalogFromStore = useAdminStore((s) => s.permissionCatalog)
  const [catalogNames, setCatalogNames] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preset, setPreset] = useState<AccessPresetId>('view')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isApiMode()) {
        const res = await fetchAdminPermissionCatalogApi()
        setCatalogNames(res.data.map((p) => p.name))
      } else {
        setCatalogNames(catalogFromStore.map((p) => p.name))
      }
    } catch {
      setCatalogNames(catalogFromStore.map((p) => p.name))
    } finally {
      setLoading(false)
    }
  }, [catalogFromStore])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (moduleFilter === 'all') return ACCESS_MATRIX_ROWS
    return ACCESS_MATRIX_ROWS.filter((r) => r.module === moduleFilter)
  }, [moduleFilter])

  const modules = useMemo(
    () => [...new Set(ACCESS_MATRIX_ROWS.map((r) => r.module))],
    [],
  )

  const sod = useMemo(() => detectSodWarnings([...selected]), [selected])

  function cellChecked(row: MatrixArea, actionId: (typeof MATRIX_ACTIONS)[number]['id']) {
    const perms = resolveCellPermissions(row, actionId, catalogNames)
    if (!perms.length) return false
    return perms.every((p) => selected.has(p))
  }

  function toggleCell(row: MatrixArea, actionId: (typeof MATRIX_ACTIONS)[number]['id']) {
    const perms = resolveCellPermissions(row, actionId, catalogNames)
    if (!perms.length) {
      notify.info('No catalog permission mapped for this cell')
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = perms.every((p) => next.has(p))
      for (const p of perms) {
        if (allOn) next.delete(p)
        else next.add(p)
      }
      return next
    })
  }

  function applyPreset() {
    setSelected(applyPresetToSelected(preset, rows, catalogNames, selected))
    notify.success(`Applied preset: ${ACCESS_PRESETS.find((p) => p.id === preset)?.label}`)
  }

  return (
    <AdminWorkspaceShell
      title="Permission Matrix"
      description="Human-readable module × action matrix. Codes stay in catalog; apply presets then fine-tune. Use Role form to save permanently."
      workspace="people"
      favoritePath="/admin/permission-matrix"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh catalog',
            icon: RefreshCw,
            onClick: () => void load(),
            disabled: loading,
          }}
        />
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-erp-border bg-white p-3">
          <label className="text-xs">
            <span className="mb-1 block text-erp-muted">Module</span>
            <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="min-w-[10rem]">
              <option value="all">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-erp-muted">Access preset</span>
            <Select value={preset} onChange={(e) => setPreset(e.target.value as AccessPresetId)} className="min-w-[12rem]">
              {ACCESS_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <ErpButton size="sm" type="button" onClick={applyPreset}>
            Apply preset to visible rows
          </ErpButton>
          <Badge color="blue">{selected.size} permissions selected</Badge>
        </div>

        {sod.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4" /> Segregation of duties warnings (soft)
            </div>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {sod.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Module</th>
                <th className="sticky left-24 z-10 bg-slate-50 px-3 py-2">Resource</th>
                {MATRIX_ACTIONS.map((a) => (
                  <th key={a.id} className="px-2 py-2 text-center">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.module}-${row.resource}`} className="border-t border-slate-100 hover:bg-sky-50/40">
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-semibold text-slate-700">{row.module}</td>
                  <td className="sticky left-24 bg-white px-3 py-1.5 text-slate-800">{row.resource}</td>
                  {MATRIX_ACTIONS.map((a) => {
                    const perms = resolveCellPermissions(row, a.id, catalogNames)
                    const empty = perms.length === 0
                    const on = cellChecked(row, a.id)
                    return (
                      <td key={a.id} className="px-2 py-1 text-center">
                        <button
                          type="button"
                          disabled={empty}
                          title={empty ? 'Unmapped in catalog' : perms.join('\n')}
                          onClick={() => toggleCell(row, a.id)}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold',
                            empty && 'cursor-not-allowed border-dashed border-slate-200 text-slate-300',
                            !empty && on && 'border-sky-600 bg-sky-600 text-white',
                            !empty && !on && 'border-slate-300 bg-white text-slate-400 hover:border-sky-400',
                          )}
                        >
                          {empty ? '·' : on ? '✓' : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-erp-muted">
          This matrix designs a permission pack. Save it by creating/editing a Role and applying the selection (or use Role presets). Raw codes never appear as primary column labels.
        </p>
      </div>
    </AdminWorkspaceShell>
  )
}
