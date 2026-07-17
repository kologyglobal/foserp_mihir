import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calculator, Copy, Layers, Plus, Power, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Checkbox } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { seedManufacturingBoms } from '@/data/manufacturing/seed'
import {
  activateBom,
  createBom,
  duplicateBom,
  estimateBomCost,
  getBomById,
  getBomCostPreview,
  updateBom,
  type CreateBomInput,
} from '@/services/manufacturing'
import type {
  BomCostPreview,
  BomIssueMethod,
  BomLine,
  ProductionMethod,
} from '@/types/manufacturing'
import {
  BOM_ISSUE_METHOD_LABELS,
  PRODUCTION_METHOD_LABELS,
} from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

type DraftLine = Omit<BomLine, 'id' | 'lineNo'> & { key: string }

const WAREHOUSES = [
  { id: 'wh-rm', name: 'RM Stores' },
  { id: 'wh-fg', name: 'FG Stores' },
  { id: 'wh-wip', name: 'WIP Stores' },
]

const FINISHED_ITEMS = Array.from(
  new Map(
    seedManufacturingBoms.map((b) => [
      b.finishedItemId,
      {
        id: b.finishedItemId,
        code: b.finishedItemCode,
        name: b.finishedItemName,
        category: b.itemCategory,
        uom: b.baseUom,
      },
    ]),
  ).values(),
)

const DEMO_COMPONENTS = [
  { id: 'item-rm-beam', code: 'RM-BEAM-6M', name: 'Axle Beam 6M', uom: 'NOS', cost: 18000 },
  { id: 'item-rm-bearing', code: 'RM-BEARING-6205', name: 'SKF Bearing 6205', uom: 'NOS', cost: 425 },
  { id: 'item-rm-hub', code: 'RM-HUB-STD', name: 'Wheel Hub Standard', uom: 'NOS', cost: 4400 },
  { id: 'item-rm-plate', code: 'RM-MS-PLATE-10MM', name: 'MS Plate 10 MM', uom: 'KG', cost: 85 },
  { id: 'item-rm-ss', code: 'RM-SS-SHEET', name: 'SS Sheet 3MM', uom: 'KG', cost: 300 },
  { id: 'item-svc-weld', code: 'SER-JW-WELD', name: 'Job Work Welding', uom: 'JOB', cost: 45000 },
]

function emptyLine(defaultWh = WAREHOUSES[0]): DraftLine {
  return {
    key: `line-${crypto.randomUUID().slice(0, 8)}`,
    componentItemId: '',
    componentItemCode: '',
    componentItemName: '',
    requiredQuantity: 1,
    uom: 'NOS',
    warehouseId: defaultWh.id,
    warehouseName: defaultWh.name,
    scrapPercent: 0,
    availableStock: 0,
    estimatedCost: 0,
    supplyMethod: 'inventory',
    issueMethod: 'auto',
    remarks: '',
  }
}

function CostPanel({ preview }: { preview: BomCostPreview }) {
  return (
    <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-erp-text">Cost Estimate</h3>
      <dl className="space-y-2 text-[13px]">
        {([
          ['Material', preview.materialCost],
          ['Labour', preview.estimatedLabourCost],
          ['Machine', preview.estimatedMachineCost],
          ['Job Work', preview.jobWorkCost],
          ['Overhead', preview.overhead],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-erp-muted">{label}</dt>
            <dd className="tabular-nums">{formatCurrency(value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-erp-border pt-2 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(preview.totalEstimatedCost)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-erp-muted">
          <dt>Per unit</dt>
          <dd className="tabular-nums">{formatCurrency(preview.estimatedCostPerUnit)}</dd>
        </div>
      </dl>
    </section>
  )
}

export function BomFormPage() {
  const { bomId } = useParams()
  const isEdit = Boolean(bomId)
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [showCost, setShowCost] = useState(false)
  const [savedCost, setSavedCost] = useState<BomCostPreview | null>(null)
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive'>('draft')

  const [bomNumber, setBomNumber] = useState('(auto)')
  const [version, setVersion] = useState('V1')
  const [finishedItemId, setFinishedItemId] = useState('')
  const [finishedItemCode, setFinishedItemCode] = useState('')
  const [finishedItemName, setFinishedItemName] = useState('')
  const [itemCategory, setItemCategory] = useState('Finished Goods')
  const [productionQuantity, setProductionQuantity] = useState(1)
  const [baseUom, setBaseUom] = useState('NOS')
  const [productionMethod, setProductionMethod] = useState<ProductionMethod>('in_house')
  const [defaultMaterialWarehouseId, setDefaultMaterialWarehouseId] = useState('wh-rm')
  const [defaultMaterialWarehouseName, setDefaultMaterialWarehouseName] = useState('RM Stores')
  const [qualityRequired, setQualityRequired] = useState(true)
  const [autoConsumption, setAutoConsumption] = useState(true)
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])

  const canAccess = isEdit ? perms.canEditBom : perms.canCreateBom

  useEffect(() => {
    if (!bomId) return
    let cancelled = false
    getBomById(bomId).then((bom) => {
      if (cancelled) return
      if (!bom) {
        notify.error('BOM not found')
        navigate('/manufacturing/bom')
        return
      }
      setBomNumber(bom.bomNumber)
      setVersion(bom.version)
      setStatus(bom.status)
      setFinishedItemId(bom.finishedItemId)
      setFinishedItemCode(bom.finishedItemCode)
      setFinishedItemName(bom.finishedItemName)
      setItemCategory(bom.itemCategory)
      setProductionQuantity(bom.productionQuantity)
      setBaseUom(bom.baseUom)
      setProductionMethod(bom.productionMethod)
      setDefaultMaterialWarehouseId(bom.defaultMaterialWarehouseId)
      setDefaultMaterialWarehouseName(bom.defaultMaterialWarehouseName)
      setQualityRequired(bom.qualityRequired)
      setAutoConsumption(bom.autoConsumption ?? true)
      setLines(
        bom.lines.map((l) => ({
          key: l.id,
          componentItemId: l.componentItemId,
          componentItemCode: l.componentItemCode,
          componentItemName: l.componentItemName,
          requiredQuantity: l.requiredQuantity,
          uom: l.uom,
          warehouseId: l.warehouseId,
          warehouseName: l.warehouseName,
          scrapPercent: l.scrapPercent,
          availableStock: l.availableStock,
          estimatedCost: l.estimatedCost,
          supplyMethod: l.supplyMethod,
          issueMethod: l.issueMethod ?? 'auto',
          remarks: l.remarks ?? '',
        })),
      )
      setLoading(false)
      if (perms.canViewCost) {
        void getBomCostPreview(bom.id).then((c) => setSavedCost(c))
      }
    })
    return () => { cancelled = true }
  }, [bomId, navigate, perms.canViewCost])

  const liveCost = useMemo(() => {
    if (!perms.canViewCost) return null
    return estimateBomCost(
      lines.map((l) => ({
        estimatedCost: l.estimatedCost,
        scrapPercent: l.scrapPercent,
        supplyMethod: l.supplyMethod,
        issueMethod: l.issueMethod,
      })),
      productionQuantity,
      productionMethod,
    )
  }, [lines, productionQuantity, productionMethod, perms.canViewCost])

  const applyFinishedItem = (id: string) => {
    const item = FINISHED_ITEMS.find((f) => f.id === id)
    setFinishedItemId(id)
    if (item) {
      setFinishedItemCode(item.code)
      setFinishedItemName(item.name)
      setItemCategory(item.category)
      setBaseUom(item.uom)
    }
  }

  const setDefaultWarehouse = (id: string) => {
    const wh = WAREHOUSES.find((w) => w.id === id) ?? WAREHOUSES[0]
    setDefaultMaterialWarehouseId(wh.id)
    setDefaultMaterialWarehouseName(wh.name)
  }

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const pickComponent = (key: string, componentId: string) => {
    const c = DEMO_COMPONENTS.find((x) => x.id === componentId)
    if (!c) {
      updateLine(key, { componentItemId: componentId })
      return
    }
    updateLine(key, {
      componentItemId: c.id,
      componentItemCode: c.code,
      componentItemName: c.name,
      uom: c.uom,
      estimatedCost: c.cost,
      availableStock: 10,
    })
  }

  const buildInput = (): CreateBomInput => ({
    finishedItemId,
    finishedItemCode,
    finishedItemName,
    itemCategory,
    productionQuantity,
    productionMethod,
    baseUom,
    version,
    defaultMaterialWarehouseId,
    defaultMaterialWarehouseName,
    defaultFgWarehouseId: 'wh-fg',
    defaultFgWarehouseName: 'FG Stores',
    qualityRequired,
    autoConsumption,
    lines: lines.map(({ key: _k, ...rest }) => rest),
  })

  const onSaveDraft = async () => {
    setSaving(true)
    try {
      const input = buildInput()
      const result = isEdit && bomId
        ? await updateBom(bomId, { ...input, status: 'draft' })
        : await createBom(input)
      if (!result.ok) {
        notify.error(result.error)
        return
      }
      notify.success(isEdit ? 'Draft saved' : 'BOM saved as draft')
      navigate(`/manufacturing/bom/${result.bom.id}`)
    } finally {
      setSaving(false)
    }
  }

  const onActivate = async () => {
    if (!perms.canActivateBom) {
      notify.error('Permission denied')
      return
    }
    setSaving(true)
    try {
      const input = buildInput()
      let id = bomId
      if (!isEdit || !id) {
        const created = await createBom(input)
        if (!created.ok) {
          notify.error(created.error)
          return
        }
        id = created.bom.id
      } else {
        const updated = await updateBom(id, input)
        if (!updated.ok) {
          notify.error(updated.error)
          return
        }
      }
      const act = await activateBom(id)
      if (!act.ok) {
        notify.error(act.error)
        return
      }
      notify.success('BOM activated')
      navigate(`/manufacturing/bom/${act.bom.id}`)
    } finally {
      setSaving(false)
    }
  }

  const onDuplicate = async () => {
    if (!bomId || !perms.canCreateBom) return
    setSaving(true)
    try {
      const r = await duplicateBom(bomId)
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success('BOM duplicated')
      navigate(`/manufacturing/bom/${r.bom.id}/edit`)
    } finally {
      setSaving(false)
    }
  }

  if (!canAccess) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title={isEdit ? 'Edit BOM' : 'New BOM'}
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'BOM', to: '/manufacturing/bom' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={Layers} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading) return <LoadingState variant="form" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={isEdit ? `Edit ${bomNumber}` : 'New BOM'}
      description="Pick finished item, add materials, save draft or activate."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'BOM', to: '/manufacturing/bom' },
        { label: isEdit ? bomNumber : 'New' },
      ]}
      autoBreadcrumbs={false}
      favoritePath={isEdit ? `/manufacturing/bom/${bomId}/edit` : '/manufacturing/bom/new'}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save Draft',
            onClick: () => void onSaveDraft(),
            disabled: saving || status === 'active',
          }}
          secondaryActions={[
            ...(perms.canActivateBom
              ? [{ id: 'activate', label: 'Activate BOM', icon: Power, onClick: () => void onActivate(), disabled: saving }]
              : []),
            ...(isEdit && perms.canCreateBom
              ? [{ id: 'dup', label: 'Duplicate BOM', icon: Copy, onClick: () => void onDuplicate(), disabled: saving }]
              : []),
            ...(perms.canViewCost
              ? [{ id: 'cost', label: showCost ? 'Hide Cost' : 'View Cost Estimate', icon: Calculator, onClick: () => setShowCost((v) => !v) }]
              : []),
            { id: 'cancel', label: 'Cancel', onClick: () => navigate(isEdit && bomId ? `/manufacturing/bom/${bomId}` : '/manufacturing/bom') },
          ]}
        />
      )}
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner message="BOM is demo-only. Keep fields light — materials drive production." />

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-4">
            <ErpCardSection title="BOM Header" collapsible defaultOpen accent="blue">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Finished Item" required>
                  <Select value={finishedItemId} onChange={(e) => applyFinishedItem(e.target.value)}>
                    <option value="">Select finished item…</option>
                    {FINISHED_ITEMS.map((f) => (
                      <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="BOM Version">
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="V1" />
                </FormField>
                <FormField label="Unit of Measure">
                  <Input value={baseUom} onChange={(e) => setBaseUom(e.target.value)} />
                </FormField>
                <FormField label="Quantity Basis" required>
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={productionQuantity}
                    onChange={(e) => setProductionQuantity(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Production Method" required>
                  <Select
                    value={productionMethod}
                    onChange={(e) => setProductionMethod(e.target.value as ProductionMethod)}
                  >
                    {(Object.keys(PRODUCTION_METHOD_LABELS) as ProductionMethod[]).map((m) => (
                      <option key={m} value={m}>{PRODUCTION_METHOD_LABELS[m]}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default Warehouse">
                  <Select
                    value={defaultMaterialWarehouseId}
                    onChange={(e) => setDefaultWarehouse(e.target.value)}
                  >
                    {WAREHOUSES.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </FormField>
                <div className="flex flex-col justify-end gap-3 sm:col-span-2 lg:col-span-3">
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox checked={qualityRequired} onChange={(e) => setQualityRequired(e.target.checked)} />
                    QC Required
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox checked={autoConsumption} onChange={(e) => setAutoConsumption(e.target.checked)} />
                    Auto Consumption
                  </label>
                </div>
              </div>
            </ErpCardSection>

            <ErpCardSection
              title="Components"
              collapsible
              defaultOpen
              accent="teal"
              badge={<span className="text-[11px] text-erp-muted">{lines.length} line{lines.length === 1 ? '' : 's'}</span>}
            >
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[880px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Raw Material Item</th>
                      <th>Required Qty</th>
                      <th>UOM</th>
                      <th>Wastage %</th>
                      <th>Source Warehouse</th>
                      <th>Issue Method</th>
                      <th>Remarks</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.key}>
                        <td className="min-w-[200px]">
                          <Select
                            value={line.componentItemId}
                            onChange={(e) => pickComponent(line.key, e.target.value)}
                          >
                            <option value="">Select…</option>
                            {DEMO_COMPONENTS.map((c) => (
                              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Input
                            type="number"
                            min={0.001}
                            step="any"
                            className="w-24"
                            value={line.requiredQuantity}
                            onChange={(e) => updateLine(line.key, { requiredQuantity: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <Input
                            className="w-20"
                            value={line.uom}
                            onChange={(e) => updateLine(line.key, { uom: e.target.value })}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            min={0}
                            className="w-20"
                            value={line.scrapPercent}
                            onChange={(e) => updateLine(line.key, { scrapPercent: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <Select
                            value={line.warehouseId}
                            onChange={(e) => {
                              const wh = WAREHOUSES.find((w) => w.id === e.target.value)
                              updateLine(line.key, {
                                warehouseId: e.target.value,
                                warehouseName: wh?.name ?? e.target.value,
                              })
                            }}
                          >
                            {WAREHOUSES.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            value={line.issueMethod}
                            onChange={(e) => {
                              const issueMethod = e.target.value as BomIssueMethod
                              updateLine(line.key, {
                                issueMethod,
                                supplyMethod: issueMethod === 'manual' ? 'vendor_supplied' : 'inventory',
                              })
                            }}
                          >
                            {(Object.keys(BOM_ISSUE_METHOD_LABELS) as BomIssueMethod[]).map((m) => (
                              <option key={m} value={m}>{BOM_ISSUE_METHOD_LABELS[m]}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Input
                            className="min-w-[120px]"
                            value={line.remarks ?? ''}
                            onChange={(e) => updateLine(line.key, { remarks: e.target.value })}
                            placeholder="Optional"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="erp-btn erp-btn-ghost h-8 w-8 p-0"
                            aria-label="Remove line"
                            onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== line.key)))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="erp-btn erp-btn-secondary mt-3 inline-flex h-9 items-center gap-2 px-3 text-[13px]"
                onClick={() => setLines((prev) => [
                  ...prev,
                  emptyLine({ id: defaultMaterialWarehouseId, name: defaultMaterialWarehouseName }),
                ])}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add Component
              </button>
            </ErpCardSection>
          </div>

          {showCost && perms.canViewCost && (liveCost || savedCost) ? (
            <CostPanel preview={liveCost ?? savedCost!} />
          ) : (
            <aside className="rounded-xl border border-dashed border-erp-border p-4 text-[13px] text-erp-muted">
              {perms.canViewCost
                ? 'Use View Cost Estimate to preview material and overhead cost.'
                : 'Cost estimate hidden by permission.'}
            </aside>
          )}
        </div>
      </div>
    </OperationalPageShell>
  )
}
