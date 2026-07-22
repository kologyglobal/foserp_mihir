import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Layers, Plus, RefreshCw, Upload } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { DynamicsKpiRow, DynamicsKpiTile } from '@/components/dynamics/DynamicsKpiTile'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { createBom, createBomVersion, downloadBomImportTemplate, listBoms, type BomImportResult } from '@/services/api/manufacturingApi'
import type { Bom, ManufacturingVersionStatus } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'
import { useSetupLookup } from '../useSetupLookups'
import { BomCsvImportDialog } from './BomCsvImportDialog'

interface BomFormState {
  code: string
  name: string
  productItemId: string
  description: string
  baseUomId: string
  baseQuantity: string
}

const EMPTY_FORM: BomFormState = {
  code: '',
  name: '',
  productItemId: '',
  description: '',
  baseUomId: '',
  baseQuantity: '1',
}

const VERSION_STATUS_TONE: Record<ManufacturingVersionStatus, ErpStatusChipTone> = {
  DRAFT: 'pending',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUPERSEDED: 'neutral',
  ARCHIVED: 'neutral',
}

type LifecycleFilter = '' | 'live' | 'draft' | 'inactive'

/** Live = has an ACTIVE revision; Draft = newest revision still in DRAFT with none active. */
function bomLifecycle(row: Bom): Exclude<LifecycleFilter, ''> | 'idle' {
  if (!row.isActive) return 'inactive'
  const versions = row.versions ?? []
  if (versions.some((v) => v.status === 'ACTIVE')) return 'live'
  if (versions[0]?.status === 'DRAFT') return 'draft'
  return 'idle'
}

export function BomsSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Bom[]>([])
  const { options: items } = useSetupLookup('items')
  const { options: uoms } = useSetupLookup('uom')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState<BomFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [setupApiAvailable, setSetupApiAvailable] = useState(false)

  const itemLabel = useCallback((id: string) => items.find((i) => i.id === id)?.label ?? `${id.slice(0, 8)}…`, [items])

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listBoms({ search: search || undefined, limit: 100 })
      setRows(res.data)
      setSetupApiAvailable(true)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load BOMs')
      setRows([])
      setSetupApiAvailable(false)
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
      const bom = await createBom({
        code: form.code.trim(),
        name: form.name.trim(),
        productItemId: form.productItemId,
        description: form.description.trim() || undefined,
      })
      await createBomVersion(bom.data.id, {
        revisionCode: 'A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        baseQuantity: Number(form.baseQuantity) || 1,
        baseUomId: form.baseUomId,
      })
      notify.success('BOM created with first draft version.')
      setDrawerOpen(false)
      navigate(`/manufacturing/setup/boms/${bom.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.code.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false
      if (!lifecycleFilter) return true
      const lifecycle = bomLifecycle(r)
      if (lifecycleFilter === 'live') return lifecycle === 'live'
      if (lifecycleFilter === 'draft') return lifecycle === 'draft'
      return lifecycle === 'inactive'
    })
  }, [rows, search, lifecycleFilter])

  const stats = useMemo(() => {
    let live = 0
    let draft = 0
    let inactive = 0
    for (const row of rows) {
      const lifecycle = bomLifecycle(row)
      if (lifecycle === 'live') live += 1
      else if (lifecycle === 'draft') draft += 1
      else if (lifecycle === 'inactive') inactive += 1
    }
    return { total: rows.length, live, draft, inactive }
  }, [rows])

  const imported = (result: BomImportResult) => {
    setImportOpen(false)
    notify.success(`Imported ${result.importedBomCount} BOM(s) and ${result.importedLineCount} component lines as Draft.`)
    const first = result.created[0]
    if (first) navigate(`/manufacturing/setup/bom-versions/${first.versionId}`)
  }

  const downloadTemplate = async () => {
    try {
      await downloadBomImportTemplate()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Template download failed')
    }
  }

  const kpiClick = (value: LifecycleFilter) => () => setLifecycleFilter((current) => (current === value ? '' : value))

  return (
    <ManufacturingSetupShell
      title="BOMs"
      description="Multi-level bills of material with revision control for production."
      actions={
        apiMode && (perms.canManageBom || (perms.canImportBom && setupApiAvailable)) ? (
          <div className="flex flex-wrap gap-2">
            {perms.canImportBom && setupApiAvailable ? (
              <>
                <ErpButton size="sm" variant="outline" onClick={() => void downloadTemplate()}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Template
                </ErpButton>
                <ErpButton size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  Import CSV
                </ErpButton>
              </>
            ) : null}
            {perms.canManageBom ? (
              <ErpButton size="sm" onClick={openNew}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                New BOM
              </ErpButton>
            ) : null}
          </div>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup ? (
        <EmptyState icon={Layers} title="Access denied" description="Missing BOM view permission." />
      ) : (
        <>
          <DynamicsKpiRow columns={4} className="mb-4">
            <DynamicsKpiTile
              label="Total BOMs"
              value={stats.total}
              helper="All bills of material"
              tone="primary"
              onClick={kpiClick('')}
              active={lifecycleFilter === ''}
            />
            <DynamicsKpiTile
              label="Live"
              value={stats.live}
              helper="Active revision released"
              tone="success"
              onClick={kpiClick('live')}
              active={lifecycleFilter === 'live'}
            />
            <DynamicsKpiTile
              label="Draft in progress"
              value={stats.draft}
              helper="Awaiting validation / activation"
              tone="warning"
              onClick={kpiClick('draft')}
              active={lifecycleFilter === 'draft'}
            />
            <DynamicsKpiTile
              label="Inactive"
              value={stats.inactive}
              helper="Retired BOM headers"
              tone="neutral"
              onClick={kpiClick('inactive')}
              active={lifecycleFilter === 'inactive'}
            />
          </DynamicsKpiRow>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="w-64" />
            <Select
              native
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value as LifecycleFilter)}
              wrapClassName="w-44"
              className="h-8 text-[12px]"
            >
              <option value="">All statuses</option>
              <option value="live">Live (active revision)</option>
              <option value="draft">Draft in progress</option>
              <option value="inactive">Inactive</option>
            </Select>
            <ErpButton size="sm" variant="ghost" onClick={() => void load()} aria-label="Refresh list">
              <RefreshCw className="h-3.5 w-3.5" />
            </ErpButton>
            <span className="ml-auto text-[11px] tabular-nums text-erp-muted">
              {filtered.length} of {rows.length} BOMs
            </span>
          </div>

          {loading ? <LoadingState variant="table" rows={6} cols={6} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={rows.length === 0 ? 'No BOMs yet' : 'No BOMs match the current filters'}
              description={
                rows.length === 0
                  ? 'Create a BOM for a finished item, or import a multi-level BOM from CSV.'
                  : 'Adjust the search or status filter to see more results.'
              }
            />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-erp-border bg-erp-surface shadow-sm">
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[860px] text-left text-[12px]">
                  <thead>
                    <tr>
                      <th>BOM</th>
                      <th>Output Item</th>
                      <th>Latest Revision</th>
                      <th className="text-center">Versions</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th className="w-10" aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const versions = row.versions ?? []
                      const latest = versions[0]
                      const lifecycle = bomLifecycle(row)
                      return (
                        <tr
                          key={row.id}
                          className="group cursor-pointer transition-colors hover:bg-erp-primary-soft/30"
                          onClick={() => navigate(`/manufacturing/setup/boms/${row.id}`)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
                                <Layers className="h-4 w-4" aria-hidden />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-erp-text">{row.name}</span>
                                <span className="block font-mono text-[11px] text-erp-muted">{row.code}</span>
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[260px] px-4 py-2.5">
                            <span className="block truncate" title={itemLabel(row.productItemId)}>
                              {itemLabel(row.productItemId)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {latest ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="rounded border border-erp-border bg-erp-surface-alt px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                  Rev {latest.revisionCode}
                                </span>
                                <ErpStatusChip label={latest.status} tone={VERSION_STATUS_TONE[latest.status]} />
                              </span>
                            ) : (
                              <span className="text-erp-muted">No revisions</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">{versions.length}</td>
                          <td className="px-4 py-2.5">
                            {lifecycle === 'inactive' ? (
                              <ErpStatusChip label="Inactive" tone="neutral" />
                            ) : lifecycle === 'live' ? (
                              <ErpStatusChip label="Live" tone="success" />
                            ) : lifecycle === 'draft' ? (
                              <ErpStatusChip label="Draft" tone="pending" />
                            ) : (
                              <ErpStatusChip label="Idle" tone="neutral" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-erp-muted">{formatDate(row.updatedAt)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <ChevronRight
                              className="ml-auto h-4 w-4 text-erp-muted transition-transform group-hover:translate-x-0.5 group-hover:text-erp-primary"
                              aria-hidden
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New BOM"
        eyebrow="Manufacturing Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!form.code.trim() || !form.name.trim() || !form.productItemId || !form.baseUomId}
              onClick={() => void save()}
            >
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
          <FormField label="Product Item" required hint={items.length === 0 ? 'Paste the item UUID (item lookup unavailable).' : undefined}>
            {items.length > 0 ? (
              <Select value={form.productItemId} onChange={(e) => setForm((f) => ({ ...f, productItemId: e.target.value }))}>
                <option value="">Select item…</option>
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
                placeholder="Item UUID"
              />
            )}
          </FormField>
          <FormField label="Description">
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="rounded-md border border-erp-border bg-erp-surface-alt/40 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">First draft version</p>
            <div className="space-y-3">
              <FormField label="Base Quantity" required>
                <Input
                  type="number"
                  min={0}
                  value={form.baseQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, baseQuantity: e.target.value }))}
                />
              </FormField>
              <FormField label="Base UOM" required hint={uoms.length === 0 ? 'Paste the UOM UUID (lookup unavailable).' : undefined}>
                {uoms.length > 0 ? (
                  <Select value={form.baseUomId} onChange={(e) => setForm((f) => ({ ...f, baseUomId: e.target.value }))}>
                    <option value="">Select UOM…</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={form.baseUomId}
                    onChange={(e) => setForm((f) => ({ ...f, baseUomId: e.target.value.trim() }))}
                    placeholder="UOM UUID"
                  />
                )}
              </FormField>
            </div>
          </div>
        </div>
      </AccountDrawerShell>
      <BomCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={imported}
      />
    </ManufacturingSetupShell>
  )
}
