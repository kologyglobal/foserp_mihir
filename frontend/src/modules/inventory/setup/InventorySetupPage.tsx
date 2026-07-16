import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Checkbox, Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { TabStrip } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createWarehouse,
  getInventorySetup,
  getWarehouses,
  INVENTORY_SETUP_TAB_LABELS,
  updateInventorySetupDemo,
  updateWarehouse,
} from '@/services/inventory'
import type {
  InventorySetup,
  InventorySetupTabId,
  InventoryWarehouseInput,
  InventoryWarehouseRecord,
  InventoryWarehouseType,
} from '@/types/inventoryDomain'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { INVENTORY_PERMISSIONS } from '@/utils/permissions/inventory'
import { useMasterStore } from '@/store/masterStore'
import { formatCurrency } from '@/utils/formatters/currency'

const SETUP_TABS: InventorySetupTabId[] = [
  'general',
  'warehouses',
  'item_categories',
  'uom',
  'number_series',
  'tracking',
  'quality',
  'planning',
  'approvals',
  'permissions',
  'advanced_warehouse',
]

const WAREHOUSE_TYPES: { value: InventoryWarehouseType; label: string }[] = [
  { value: 'raw', label: 'Raw Material' },
  { value: 'wip', label: 'WIP' },
  { value: 'finished', label: 'Finished Goods' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'transit', label: 'Transit' },
  { value: 'general', label: 'General' },
]

function emptyWarehouse(): InventoryWarehouseInput {
  return {
    warehouseCode: '',
    warehouseName: '',
    warehouseType: 'general',
    plantCode: 'PLT-01',
    location: '',
    warehouseManager: '',
    defaultReceiptLocationId: null,
    defaultIssueLocationId: null,
    qualityHoldLocationId: null,
    quarantineLocationId: null,
    rejectedLocationId: null,
    scrapLocationId: null,
    transitLocationId: null,
    binManagementEnabled: false,
    isActive: true,
  }
}

export function InventorySetupPage() {
  const perms = useInventoryPermissions()
  const categories = useMasterStore((s) => s.categories)
  const uoms = useMasterStore((s) => s.uoms)
  const masterWarehouses = useMasterStore((s) => s.warehouses)

  const [tab, setTab] = useState<InventorySetupTabId>('general')
  const [setup, setSetup] = useState<InventorySetup | null>(null)
  const [warehouses, setWarehouses] = useState<InventoryWarehouseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingWhId, setEditingWhId] = useState<string | null>(null)
  const [whForm, setWhForm] = useState<InventoryWarehouseInput>(emptyWarehouse())
  const [showNewWh, setShowNewWh] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, w] = await Promise.all([getInventorySetup(), getWarehouses()])
      setSetup(s)
      setWarehouses(w)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!setup) return
    setSaving(true)
    try {
      await updateInventorySetupDemo(setup)
      notify.success('Inventory setup saved (demo)')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveWarehouse() {
    try {
      if (editingWhId) {
        await updateWarehouse(editingWhId, whForm)
        notify.success('Warehouse updated')
      } else {
        await createWarehouse(whForm)
        notify.success('Warehouse created')
      }
      setShowNewWh(false)
      setEditingWhId(null)
      setWhForm(emptyWarehouse())
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Warehouse save failed')
    }
  }

  if (!perms.canManageSetup) {
    return (
      <OperationalPageShell title="Access denied" description="Inventory setup requires inventory.setup.manage.">
        <p className="text-sm text-erp-muted">Contact your administrator.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Inventory Setup"
      description="Configure warehouses, tracking, quality, planning and approvals. Advanced features disabled by default."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Setup' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/setup"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'save', label: saving ? 'Saving…' : 'Save Setup', icon: Save, onClick: () => void handleSave(), disabled: saving || !setup }}
        />
      )}
    >
      <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        Demo mode — settings saved in browser memory only. No backend API.
      </p>

      <TabStrip
        tabs={SETUP_TABS.map((id) => ({ id, label: INVENTORY_SETUP_TAB_LABELS[id] ?? id }))}
        active={tab}
        onChange={(id) => setTab(id as InventorySetupTabId)}
        className="rounded-md border border-erp-border"
      />

      {loading ? <LoadingState variant="form" /> : null}
      {!loading && setup ? (
        <div className="mt-4 space-y-4">
          {tab === 'general' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">General Settings</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Default Warehouse">
                  <Select value={setup.general.defaultWarehouseId ?? ''} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSetup({ ...setup, general: { ...setup.general, defaultWarehouseId: e.target.value || null } })}>
                    <option value="">— Select —</option>
                    {masterWarehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
                  </Select>
                </FormField>
                <FormField label="Default Costing Method">
                  <Select value={setup.general.defaultCostingMethod} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSetup({ ...setup, general: { ...setup.general, defaultCostingMethod: e.target.value as InventorySetup['general']['defaultCostingMethod'] } })}>
                    <option value="standard">Standard</option>
                    <option value="average">Average</option>
                    <option value="fifo">FIFO</option>
                    <option value="specific">Specific</option>
                  </Select>
                </FormField>
                <Checkbox checked={setup.general.allowNegativeStock} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, allowNegativeStock: e.target.checked } })} label="Allow Negative Stock" />
                <Checkbox checked={setup.general.requirePostingDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, requirePostingDate: e.target.checked } })} label="Require Posting Date" />
                <Checkbox checked={setup.general.requireSourceDocument} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, requireSourceDocument: e.target.checked } })} label="Require Source Document" />
                <Checkbox checked={setup.general.quickModeDefault} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, quickModeDefault: e.target.checked } })} label="Quick Mode Default" />
                <Checkbox checked={setup.general.detailedModeEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, detailedModeEnabled: e.target.checked } })} label="Detailed Mode Enabled" />
                <Checkbox checked={setup.general.inventoryValueVisible} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, general: { ...setup.general, inventoryValueVisible: e.target.checked } })} label="Inventory Value Visibility" />
              </div>
            </section>
          ) : null}

          {tab === 'warehouses' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Warehouses</h2>
                <button type="button" className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1 px-3 text-[12px]" onClick={() => { setShowNewWh(true); setEditingWhId(null); setWhForm(emptyWarehouse()) }}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add Warehouse
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[800px]">
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Plant</th>
                      <th scope="col">Manager</th>
                      <th scope="col">Active</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w) => (
                      <tr key={w.id}>
                        <td className="font-mono text-xs">{w.warehouseCode}</td>
                        <td>{w.warehouseName}</td>
                        <td>{w.warehouseType}</td>
                        <td>{w.plantCode}</td>
                        <td>{w.warehouseManager}</td>
                        <td>{w.isActive ? 'Yes' : 'No'}</td>
                        <td>
                          <button type="button" className="text-[12px] text-erp-primary underline" onClick={() => { setEditingWhId(w.id); setShowNewWh(true); setWhForm({ ...w }) }}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showNewWh ? (
                <div className="mt-4 rounded border border-erp-border p-4">
                  <h3 className="mb-3 text-[13px] font-semibold">{editingWhId ? 'Edit Warehouse' : 'New Warehouse'}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Warehouse Code"><Input value={whForm.warehouseCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, warehouseCode: e.target.value })} /></FormField>
                    <FormField label="Warehouse Name"><Input value={whForm.warehouseName} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, warehouseName: e.target.value })} /></FormField>
                    <FormField label="Warehouse Type">
                      <Select value={whForm.warehouseType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setWhForm({ ...whForm, warehouseType: e.target.value as InventoryWarehouseType })}>
                        {WAREHOUSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Plant"><Input value={whForm.plantCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, plantCode: e.target.value })} /></FormField>
                    <FormField label="Location"><Input value={whForm.location} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, location: e.target.value })} /></FormField>
                    <FormField label="Warehouse Manager"><Input value={whForm.warehouseManager} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, warehouseManager: e.target.value })} /></FormField>
                    <Checkbox checked={whForm.binManagementEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, binManagementEnabled: e.target.checked })} label="Bin Management Enabled" />
                    <Checkbox checked={whForm.isActive} onChange={(e: ChangeEvent<HTMLInputElement>) => setWhForm({ ...whForm, isActive: e.target.checked })} label="Active" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => void handleSaveWarehouse()}>Save Warehouse</button>
                    <button type="button" className="erp-btn erp-btn-ghost h-9 px-4 text-[13px]" onClick={() => { setShowNewWh(false); setEditingWhId(null) }}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === 'item_categories' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Item Categories</h2>
              <p className="mb-3 text-[12px] text-erp-muted">Categories are maintained in Master Data — no duplicate source.</p>
              <Link to="/masters/item-categories" className="text-erp-primary underline">Open Item Category Master</Link>
              <ul className="mt-3 divide-y divide-erp-border text-[13px]">
                {categories.filter((c) => c.isActive).slice(0, 8).map((c) => (
                  <li key={c.id} className="py-2">{c.categoryCode} — {c.categoryName}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === 'uom' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Units of Measure</h2>
              <p className="mb-3 text-[12px] text-erp-muted">UOM master is shared — link to canonical master.</p>
              <Link to="/masters/uom" className="text-erp-primary underline">Open UOM Master</Link>
              <ul className="mt-3 divide-y divide-erp-border text-[13px]">
                {uoms.filter((u) => u.isActive).slice(0, 8).map((u) => (
                  <li key={u.id} className="py-2">{u.uomCode} — {u.uomName}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === 'number_series' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Number Series</h2>
              <div className="overflow-x-auto">
                <table className="erp-table w-full">
                  <thead><tr><th>Document</th><th>Prefix</th><th>Next No.</th><th>Padding</th></tr></thead>
                  <tbody>
                    {(['receipt', 'issue', 'transfer', 'adjustment', 'stockCount'] as const).map((key) => (
                      <tr key={key}>
                        <td className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</td>
                        <td><Input value={setup.numberSeries[key].prefix} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, numberSeries: { ...setup.numberSeries, [key]: { ...setup.numberSeries[key], prefix: e.target.value } } })} /></td>
                        <td><Input type="number" value={setup.numberSeries[key].nextNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, numberSeries: { ...setup.numberSeries, [key]: { ...setup.numberSeries[key], nextNumber: Number(e.target.value) } } })} /></td>
                        <td><Input type="number" value={setup.numberSeries[key].padding} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, numberSeries: { ...setup.numberSeries, [key]: { ...setup.numberSeries[key], padding: Number(e.target.value) } } })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'tracking' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Tracking</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox checked={setup.tracking.batchTrackingEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, batchTrackingEnabled: e.target.checked } })} label="Batch Tracking Enabled" />
                <Checkbox checked={setup.tracking.serialTrackingEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, serialTrackingEnabled: e.target.checked } })} label="Serial Tracking Enabled" />
                <Checkbox checked={setup.tracking.expiryTrackingEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, expiryTrackingEnabled: e.target.checked } })} label="Expiry Tracking Enabled" />
                <Checkbox checked={setup.tracking.automaticBatchSelection} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, automaticBatchSelection: e.target.checked } })} label="Automatic Batch Selection" />
                <FormField label="Batch Selection Method">
                  <Select value={setup.tracking.batchSelectionMethod} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, batchSelectionMethod: e.target.value as 'fifo' | 'fefo' | 'manual' } })}>
                    <option value="fifo">FIFO</option>
                    <option value="fefo">FEFO</option>
                    <option value="manual">Manual</option>
                  </Select>
                </FormField>
                <FormField label="Expiry Warning Days"><Input type="number" value={setup.tracking.expiryWarningDays} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, expiryWarningDays: Number(e.target.value) } })} /></FormField>
                <Checkbox checked={setup.tracking.serialUniquenessRequired} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, tracking: { ...setup.tracking, serialUniquenessRequired: e.target.checked } })} label="Serial Uniqueness Required" />
              </div>
            </section>
          ) : null}

          {tab === 'quality' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Quality</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox checked={setup.quality.qualityInspectionEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, quality: { ...setup.quality, qualityInspectionEnabled: e.target.checked } })} label="Quality Inspection Enabled" />
                <Checkbox checked={setup.quality.deviationApprovalRequired} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, quality: { ...setup.quality, deviationApprovalRequired: e.target.checked } })} label="Deviation Approval Required" />
                <p className="sm:col-span-2 text-[12px] text-erp-muted">Quality hold / quarantine / rejected locations use logical locations within warehouses — no forced separate physical warehouses.</p>
              </div>
            </section>
          ) : null}

          {tab === 'planning' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Planning</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox checked={setup.planning.reorderPlanningEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, planning: { ...setup.planning, reorderPlanningEnabled: e.target.checked } })} label="Reorder Planning Enabled" />
                <FormField label="Default Safety Stock"><Input type="number" value={setup.planning.defaultSafetyStock} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, planning: { ...setup.planning, defaultSafetyStock: Number(e.target.value) } })} /></FormField>
                <FormField label="Default Lead Time (days)"><Input type="number" value={setup.planning.defaultLeadTimeDays} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, planning: { ...setup.planning, defaultLeadTimeDays: Number(e.target.value) } })} /></FormField>
                <Checkbox checked={setup.planning.createDraftRequirementOnly} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, planning: { ...setup.planning, createDraftRequirementOnly: e.target.checked } })} label="Create Draft Requirement Only" />
              </div>
            </section>
          ) : null}

          {tab === 'approvals' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Approvals</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Adjustment Approval Limit"><Input type="number" value={setup.approvals.adjustmentApprovalLimit} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, approvals: { ...setup.approvals, adjustmentApprovalLimit: Number(e.target.value) } })} /></FormField>
                <FormField label="High-Value Transfer Approval"><Input type="number" value={setup.approvals.highValueTransferApproval} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, approvals: { ...setup.approvals, highValueTransferApproval: Number(e.target.value) } })} /></FormField>
                <FormField label="Stock Count Variance Limit"><Input type="number" value={setup.approvals.stockCountVarianceLimit} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, approvals: { ...setup.approvals, stockCountVarianceLimit: Number(e.target.value) } })} /></FormField>
                <Checkbox checked={setup.approvals.negativeStockOverrideApproval} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, approvals: { ...setup.approvals, negativeStockOverrideApproval: e.target.checked } })} label="Negative Stock Override Approval" />
                <Checkbox checked={setup.approvals.qualityDeviationApproval} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, approvals: { ...setup.approvals, qualityDeviationApproval: e.target.checked } })} label="Quality Deviation Approval" />
              </div>
              <p className="mt-2 text-[12px] text-erp-muted">Limits shown as {formatCurrency(setup.approvals.adjustmentApprovalLimit)} (demo).</p>
            </section>
          ) : null}

          {tab === 'permissions' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Permissions Reference</h2>
              <p className="mb-3 text-[12px] text-erp-muted">UI gating catalog — assign via Role Admin. Backend authorization must enforce the same permission rules.</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {INVENTORY_PERMISSIONS.map((p: string) => (
                  <li key={p} className="font-mono text-[11px] text-erp-text">{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === 'advanced_warehouse' ? (
            <section className="crm-masters-card rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold">Advanced Warehouse</h2>
              <p className="mb-3 text-[12px] text-amber-800">All advanced features are disabled by default in demo mode.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['binManagement', 'barcodeScanning', 'putAway', 'pickList', 'packing', 'wavePicking', 'mobileWarehouse', 'consignmentInventory'] as const).map((key) => (
                  <Checkbox
                    key={key}
                    checked={setup.advancedWarehouse[key]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSetup({ ...setup, advancedWarehouse: { ...setup.advancedWarehouse, [key]: e.target.checked } })}
                    label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
