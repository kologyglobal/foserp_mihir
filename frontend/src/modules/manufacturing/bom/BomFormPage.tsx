import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Checkbox } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { seedManufacturingBoms } from '@/data/manufacturing/seed'
import {
  createBom,
  getBomById,
  getBomCostPreview,
  updateBom,
  type CreateBomInput,
} from '@/services/manufacturing'
import type {
  BomCostPreview,
  BomLine,
  ComponentSupplyMethod,
  ProductionMethod,
} from '@/types/manufacturing'
import {
  PRODUCTION_METHOD_LABELS,
  SUPPLY_METHOD_LABELS,
} from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

type FormTab = 'details' | 'materials'

type DraftLine = Omit<BomLine, 'id' | 'lineNo'> & { key: string }

const FINISHED_ITEMS = Array.from(
  new Map(
    seedManufacturingBoms.map((b) => [
      b.finishedItemId,
      {
        id: b.finishedItemId,
        code: b.finishedItemCode,
        name: b.finishedItemName,
        category: b.itemCategory,
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

function emptyLine(): DraftLine {
  return {
    key: `line-${crypto.randomUUID().slice(0, 8)}`,
    componentItemId: '',
    componentItemCode: '',
    componentItemName: '',
    requiredQuantity: 1,
    uom: 'NOS',
    warehouseId: 'wh-rm',
    warehouseName: 'RM Stores',
    scrapPercent: 0,
    availableStock: 0,
    estimatedCost: 0,
    supplyMethod: 'inventory',
  }
}

function CostPreviewPanel({ preview }: { preview: BomCostPreview }) {
  const rows: [string, number][] = [
    ['Material Cost', preview.materialCost],
    ['Estimated Labour', preview.estimatedLabourCost],
    ['Estimated Machine', preview.estimatedMachineCost],
    ['Job Work Cost', preview.jobWorkCost],
    ['Overhead', preview.overhead],
    ['Scrap Recovery', -preview.scrapRecovery],
  ]
  return (
    <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-erp-text">Cost Preview</h3>
      <dl className="space-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-erp-muted">{label}</dt>
            <dd className="tabular-nums">{formatCurrency(value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-erp-border pt-2 font-semibold">
          <dt>Total Estimated</dt>
          <dd className="tabular-nums">{formatCurrency(preview.totalEstimatedCost)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-erp-muted">
          <dt>Per Unit</dt>
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
  const [formTab, setFormTab] = useState<FormTab>('details')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [costPreview, setCostPreview] = useState<BomCostPreview | null>(null)

  const [bomNumber, setBomNumber] = useState('(auto on save)')
  const [version, setVersion] = useState('V1')
  const [status, setStatus] = useState('draft')
  const [finishedItemId, setFinishedItemId] = useState('')
  const [finishedItemCode, setFinishedItemCode] = useState('')
  const [finishedItemName, setFinishedItemName] = useState('')
  const [itemCategory, setItemCategory] = useState('Finished Goods')
  const [productionQuantity, setProductionQuantity] = useState(1)
  const [baseUom, setBaseUom] = useState('NOS')
  const [productionMethod, setProductionMethod] = useState<ProductionMethod>('in_house')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState('')
  const [defaultMaterialWarehouseId, setDefaultMaterialWarehouseId] = useState('wh-rm')
  const [defaultMaterialWarehouseName, setDefaultMaterialWarehouseName] = useState('RM Stores')
  const [defaultFgWarehouseId, setDefaultFgWarehouseId] = useState('wh-fg')
  const [defaultFgWarehouseName, setDefaultFgWarehouseName] = useState('FG Stores')
  const [qualityRequired, setQualityRequired] = useState(true)
  const [batchRequired, setBatchRequired] = useState(false)
  const [serialRequired, setSerialRequired] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])

  const canAccess = isEdit ? perms.canEditBom : perms.canCreateBom

  const refreshCost = useCallback(async (id: string) => {
    if (!perms.canViewCost) {
      setCostPreview(null)
      return
    }
    setCostPreview(await getBomCostPreview(id))
  }, [perms.canViewCost])

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
      setEffectiveFrom(bom.effectiveFrom)
      setEffectiveTo(bom.effectiveTo ?? '')
      setDefaultMaterialWarehouseId(bom.defaultMaterialWarehouseId)
      setDefaultMaterialWarehouseName(bom.defaultMaterialWarehouseName)
      setDefaultFgWarehouseId(bom.defaultFgWarehouseId)
      setDefaultFgWarehouseName(bom.defaultFgWarehouseName)
      setQualityRequired(bom.qualityRequired)
      setBatchRequired(bom.batchRequired)
      setSerialRequired(bom.serialRequired)
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
        })),
      )
      setLoading(false)
      void refreshCost(bom.id)
    })
    return () => {
      cancelled = true
    }
  }, [bomId, navigate, refreshCost])

  const applyFinishedItem = (id: string) => {
    const item = FINISHED_ITEMS.find((f) => f.id === id)
    setFinishedItemId(id)
    if (item) {
      setFinishedItemCode(item.code)
      setFinishedItemName(item.name)
      setItemCategory(item.category)
    }
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

  const payloadLines = useMemo(
    () =>
      lines.map(({ key: _key, ...rest }) => rest),
    [lines],
  )

  const onSave = async () => {
    setSaving(true)
    try {
      const input: CreateBomInput = {
        finishedItemId,
        finishedItemCode,
        finishedItemName,
        itemCategory,
        productionQuantity,
        productionMethod,
        baseUom,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        defaultMaterialWarehouseId,
        defaultMaterialWarehouseName,
        defaultFgWarehouseId,
        defaultFgWarehouseName,
        lines: payloadLines,
      }
      const result = isEdit && bomId
        ? await updateBom(bomId, input)
        : await createBom(input)
      if (!result.ok) {
        notify.error(result.error)
        return
      }
      notify.success(isEdit ? 'BOM updated' : 'BOM created')
      navigate(`/manufacturing/bom/${result.bom.id}`)
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
      description="BOM Details and Materials — operations routing is deferred."
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
            label: saving ? 'Saving…' : 'Save',
            onClick: () => void onSave(),
            disabled: saving,
          }}
          secondaryActions={[
            { id: 'cancel', label: 'Cancel', onClick: () => navigate(isEdit && bomId ? `/manufacturing/bom/${bomId}` : '/manufacturing/bom') },
          ]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap gap-1" role="tablist">
        {([
          ['details', 'BOM Details'],
          ['materials', 'Materials'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={formTab === id}
            className={cn('erp-btn h-8 px-3 text-[12px]', formTab === id ? 'erp-btn-primary' : 'erp-btn-ghost')}
            onClick={() => setFormTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          {formTab === 'details' ? (
            <>
              <ErpCardSection title="General" collapsible defaultOpen accent="blue">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="BOM Number">
                    <Input value={bomNumber} readOnly disabled />
                  </FormField>
                  <FormField label="Version">
                    <Input value={version} readOnly disabled />
                  </FormField>
                  <FormField label="Status">
                    <Input value={status} readOnly disabled className="capitalize" />
                  </FormField>
                  <FormField label="Finished Item" required>
                    <Select value={finishedItemId} onChange={(e) => applyFinishedItem(e.target.value)}>
                      <option value="">Select finished item…</option>
                      {FINISHED_ITEMS.map((f) => (
                        <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Finished Item Code" required>
                    <Input value={finishedItemCode} onChange={(e) => setFinishedItemCode(e.target.value)} />
                  </FormField>
                  <FormField label="Finished Item Name" required>
                    <Input value={finishedItemName} onChange={(e) => setFinishedItemName(e.target.value)} />
                  </FormField>
                  <FormField label="Finished Item Id" required>
                    <Input value={finishedItemId} onChange={(e) => setFinishedItemId(e.target.value)} />
                  </FormField>
                  <FormField label="Category">
                    <Input value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} />
                  </FormField>
                  <FormField label="Production Qty" required>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={productionQuantity}
                      onChange={(e) => setProductionQuantity(Number(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Base UOM">
                    <Input value={baseUom} onChange={(e) => setBaseUom(e.target.value)} />
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
                  <FormField label="Effective From">
                    <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                  </FormField>
                  <FormField label="Effective To">
                    <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
                  </FormField>
                </div>
              </ErpCardSection>

              <ErpCardSection title="Warehouses" collapsible defaultOpen accent="teal">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Material Warehouse Id">
                    <Input
                      value={defaultMaterialWarehouseId}
                      onChange={(e) => setDefaultMaterialWarehouseId(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Material Warehouse Name">
                    <Input
                      value={defaultMaterialWarehouseName}
                      onChange={(e) => setDefaultMaterialWarehouseName(e.target.value)}
                    />
                  </FormField>
                  <FormField label="FG Warehouse Id">
                    <Input value={defaultFgWarehouseId} onChange={(e) => setDefaultFgWarehouseId(e.target.value)} />
                  </FormField>
                  <FormField label="FG Warehouse Name">
                    <Input value={defaultFgWarehouseName} onChange={(e) => setDefaultFgWarehouseName(e.target.value)} />
                  </FormField>
                </div>
              </ErpCardSection>

              <ErpCardSection title="Quality & Tracking" collapsible defaultOpen={false} accent="amber">
                <div className="flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox checked={qualityRequired} onChange={(e) => setQualityRequired(e.target.checked)} />
                    Quality required
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox checked={batchRequired} onChange={(e) => setBatchRequired(e.target.checked)} />
                    Batch required
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px]">
                    <Checkbox checked={serialRequired} onChange={(e) => setSerialRequired(e.target.checked)} />
                    Serial required
                  </label>
                </div>
              </ErpCardSection>

              <ErpCardSection title="Operations" collapsible defaultOpen={false} accent="slate">
                <p className="text-[13px] text-erp-muted">
                  Routing / operations will be enabled in a later manufacturing phase. Material planning does not require operations.
                </p>
              </ErpCardSection>
            </>
          ) : (
            <ErpCardSection
              title="Materials"
              collapsible
              defaultOpen
              accent="teal"
              badge={<span className="text-[11px] text-erp-muted">{lines.length} line{lines.length === 1 ? '' : 's'}</span>}
            >
              <div className="overflow-x-auto">
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Component</th>
                      <th>Qty</th>
                      <th>UOM</th>
                      <th>Scrap %</th>
                      <th>Supply</th>
                      <th>Est. Cost</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line.key}>
                        <td className="tabular-nums">{idx + 1}</td>
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
                            value={line.supplyMethod}
                            onChange={(e) =>
                              updateLine(line.key, { supplyMethod: e.target.value as ComponentSupplyMethod })
                            }
                          >
                            {(Object.keys(SUPPLY_METHOD_LABELS) as ComponentSupplyMethod[]).map((s) => (
                              <option key={s} value={s}>{SUPPLY_METHOD_LABELS[s]}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="tabular-nums">
                          {perms.canViewCost ? formatCurrency(line.estimatedCost) : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="erp-btn erp-btn-ghost h-8 w-8 p-0"
                            aria-label="Remove line"
                            onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
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
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add Material
              </button>
            </ErpCardSection>
          )}
        </div>

        {perms.canViewCost && costPreview ? <CostPreviewPanel preview={costPreview} /> : (
          <aside className="rounded-lg border border-dashed border-erp-border p-4 text-[13px] text-erp-muted">
            {perms.canViewCost
              ? 'Cost preview appears after the BOM is saved.'
              : 'Cost preview hidden — missing view cost permission.'}
          </aside>
        )}
      </div>
    </OperationalPageShell>
  )
}
