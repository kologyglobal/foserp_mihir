import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { createRouting, createRoutingVersion, listRoutings } from '@/services/api/manufacturingApi'
import type { Routing } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'
import { useSetupLookup } from '../useSetupLookups'

interface RoutingFormState {
  code: string
  name: string
  productItemId: string
  description: string
}

const EMPTY_FORM: RoutingFormState = { code: '', name: '', productItemId: '', description: '' }

export function RoutingsSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Routing[]>([])
  const { options: items } = useSetupLookup('items')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState<RoutingFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const itemLabel = useCallback(
    (id: string | null) => (id ? items.find((i) => i.id === id)?.label ?? `${id.slice(0, 8)}…` : '—'),
    [items],
  )

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listRoutings({ search: search || undefined, limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load routings')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const routing = await createRouting({
        code: form.code.trim(),
        name: form.name.trim(),
        productItemId: form.productItemId || undefined,
        description: form.description.trim() || undefined,
      })
      await createRoutingVersion(routing.data.id, {
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
      })
      notify.success('Routing created with first draft version.')
      setDrawerOpen(false)
      navigate(`/manufacturing/setup/routings/${routing.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <ManufacturingSetupShell
      title="Routings"
      actions={
        apiMode && perms.canManageRouting ? (
          <ErpButton size="sm" onClick={openNew}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Routing
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup ? (
        <EmptyState icon={GitBranch} title="Access denied" description="Missing routing view permission." />
      ) : (
        <>
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={5} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState icon={GitBranch} title="No routings found" description="Create a routing describing how an item is produced." />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Product Item</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/manufacturing/setup/routings/${row.id}`)}
                    >
                      <td className="font-mono text-[11px]">{row.code}</td>
                      <td className="font-medium">{row.name}</td>
                      <td className="font-mono text-[11px]" title={row.productItemId ?? undefined}>
                        {itemLabel(row.productItemId)}
                      </td>
                      <td>
                        <StatusDot
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={statusToneFromLabel(row.isActive ? 'active' : 'inactive')}
                        />
                      </td>
                      <td>{row.updatedAt.slice(0, 10)}</td>
                      <td className="text-right text-erp-primary">Open →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Routing"
        eyebrow="Manufacturing Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton loading={saving} disabled={!form.code.trim() || !form.name.trim()} onClick={() => void save()}>
              Create
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Product Item" hint="Optional — leave blank for a generic routing.">
            {items.length > 0 ? (
              <Select value={form.productItemId} onChange={(e) => setForm((f) => ({ ...f, productItemId: e.target.value }))}>
                <option value="">Not set</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={form.productItemId}
                onChange={(e) => setForm((f) => ({ ...f, productItemId: e.target.value.trim() }))}
                placeholder="Item UUID (optional)"
              />
            )}
          </FormField>
          <FormField label="Description">
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
        </div>
      </AccountDrawerShell>
    </ManufacturingSetupShell>
  )
}
