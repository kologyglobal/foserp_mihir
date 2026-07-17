import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardSection } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { ManufacturingAiAssist, ManufacturingDemoBanner } from '@/components/manufacturing'
import { buildProductionPlanAiInsights } from '@/utils/manufacturing/insights'
import { seedManufacturingBoms } from '@/data/manufacturing/seed'
import { createProductionPlan } from '@/services/manufacturing'
import type { BomReadinessStatus, MaterialAvailabilityStatus, ProductionMethod, ProductionPlanSource } from '@/types/manufacturing'
import {
  BOM_READINESS_LABELS,
  MATERIAL_STATUS_LABELS,
  PRODUCTION_METHOD_LABELS,
  PRODUCTION_PLAN_SOURCE_LABELS,
} from '@/types/manufacturing'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

type DraftLine = {
  key: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  demandQuantity: number
  availableFinishedStock: number
  requiredDate: string
  productionMethod: ProductionMethod
  bomStatus: BomReadinessStatus
  materialStatus: MaterialAvailabilityStatus
}

const FINISHED_ITEMS = Array.from(
  new Map(
    seedManufacturingBoms.map((b) => [
      b.finishedItemId,
      {
        id: b.finishedItemId,
        code: b.finishedItemCode,
        name: b.finishedItemName,
        method: b.productionMethod,
        bomStatus: (b.status === 'active' ? 'active' : b.status === 'draft' ? 'draft' : 'inactive') as BomReadinessStatus,
      },
    ]),
  ).values(),
)

const WAREHOUSES = [
  { id: 'wh-fg', name: 'FG Stores' },
  { id: 'wh-rm', name: 'RM Stores' },
  { id: 'wh-wip', name: 'WIP Stores' },
]

function emptyLine(): DraftLine {
  const today = new Date().toISOString().slice(0, 10)
  return {
    key: `pl-${crypto.randomUUID().slice(0, 8)}`,
    finishedItemId: '',
    finishedItemCode: '',
    finishedItemName: '',
    demandQuantity: 1,
    availableFinishedStock: 0,
    requiredDate: today,
    productionMethod: 'in_house',
    bomStatus: 'active',
    materialStatus: 'not_checked',
  }
}

export function ProductionPlanFormPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const today = new Date().toISOString().slice(0, 10)
  const [saving, setSaving] = useState(false)
  const [planName, setPlanName] = useState('')
  const [planDate, setPlanDate] = useState(today)
  const [source, setSource] = useState<ProductionPlanSource>('sales_order')
  const [warehouseId, setWarehouseId] = useState('wh-fg')
  const [periodFrom, setPeriodFrom] = useState(today)
  const [periodTo, setPeriodTo] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [owner, setOwner] = useState('Planning User')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])

  const warehouseName = WAREHOUSES.find((w) => w.id === warehouseId)?.name ?? 'FG Stores'

  const aiSuggestions = useMemo(() => {
    const draftPlan = {
      id: 'draft',
      planNumber: 'DRAFT',
      planDate,
      source,
      warehouseId,
      warehouseName,
      planningPeriodFrom: periodFrom,
      planningPeriodTo: periodTo,
      status: 'draft' as const,
      owner,
      totalItems: lines.filter((l) => l.finishedItemId).length,
      plannedQty: lines.reduce((s, l) => s + Math.max(0, l.demandQuantity - l.availableFinishedStock), 0),
      wosCreated: 0,
      createdBy: 'Demo User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: lines
        .filter((l) => l.finishedItemId)
        .map((l, i) => ({
          id: l.key,
          planId: 'draft',
          finishedItemId: l.finishedItemId,
          finishedItemCode: l.finishedItemCode,
          finishedItemName: l.finishedItemName,
          uom: 'NOS',
          demandQuantity: l.demandQuantity,
          safetyStock: 0,
          availableFinishedStock: l.availableFinishedStock,
          requiredProductionQuantity: Math.max(0, l.demandQuantity - l.availableFinishedStock),
          shortageQty: Math.max(0, l.demandQuantity - l.availableFinishedStock),
          requiredDate: l.requiredDate,
          productionMethod: l.productionMethod,
          bomStatus: l.bomStatus,
          materialStatus: l.materialStatus,
          ignored: false,
          sortOrder: i,
          woCreated: false,
        })),
    }
    if (!draftPlan.lines.length) return ['Add finished items and due dates to see planning tips.']
    return buildProductionPlanAiInsights(draftPlan as never)
  }, [lines, owner, periodFrom, periodTo, planDate, source, warehouseId, warehouseName])

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const pickItem = (key: string, itemId: string) => {
    const item = FINISHED_ITEMS.find((f) => f.id === itemId)
    if (!item) {
      updateLine(key, { finishedItemId: itemId })
      return
    }
    updateLine(key, {
      finishedItemId: item.id,
      finishedItemCode: item.code,
      finishedItemName: item.name,
      productionMethod: item.method,
      bomStatus: item.bomStatus,
      materialStatus: 'partial',
      availableFinishedStock: item.code.includes('CHS') || item.code.includes('TANK') ? 0 : 3,
    })
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const result = await createProductionPlan({
        planName: planName || `Plan ${planDate}`,
        planDate,
        source,
        warehouseId,
        warehouseName,
        planningPeriodFrom: periodFrom,
        planningPeriodTo: periodTo,
        owner,
        lines: lines
          .filter((l) => l.finishedItemId)
          .map((l) => ({
            finishedItemId: l.finishedItemId,
            finishedItemCode: l.finishedItemCode,
            finishedItemName: l.finishedItemName,
            demandQuantity: l.demandQuantity,
            availableFinishedStock: l.availableFinishedStock,
            requiredDate: l.requiredDate,
            productionMethod: l.productionMethod,
            bomStatus: l.bomStatus,
            materialStatus: l.materialStatus,
          })),
      })
      if (!result.ok) {
        notify.error(result.error)
        return
      }
      notify.success('Production plan created')
      navigate(`/manufacturing/production-plan/${result.plan.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canViewPlan) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="New Production Plan"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Production Plan', to: '/manufacturing/production-plan' },
          { label: 'New' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ClipboardList} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="New Production Plan"
      description="Capture demand lines and suggested production qty — generate WOs from the plan detail."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Production Plan', to: '/manufacturing/production-plan' },
        { label: 'New' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/production-plan/new"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save Plan',
            onClick: () => void onSave(),
            disabled: saving,
          }}
          secondaryActions={[
            { id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/production-plan') },
          ]}
        />
      )}
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner message="Keep this form for planning only. Execution happens on Work Orders / Shopfloor." />

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-4">
            <ErpCardSection title="Plan Header" collapsible defaultOpen accent="blue">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Plan Name / No" required>
                  <Input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Week 30 SO Plan"
                  />
                </FormField>
                <FormField label="Plan Date" required>
                  <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
                </FormField>
                <FormField label="Source" required>
                  <Select
                    value={source}
                    onChange={(e) => setSource(e.target.value as ProductionPlanSource)}
                  >
                    {(Object.keys(PRODUCTION_PLAN_SOURCE_LABELS) as ProductionPlanSource[]).map((s) => (
                      <option key={s} value={s}>{PRODUCTION_PLAN_SOURCE_LABELS[s]}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Warehouse">
                  <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {WAREHOUSES.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Planning Period From">
                  <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                </FormField>
                <FormField label="Planning Period To">
                  <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                </FormField>
                <FormField label="Owner">
                  <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
                </FormField>
              </div>
            </ErpCardSection>

            <ErpCardSection
              title="Plan Lines"
              collapsible
              defaultOpen
              accent="teal"
              badge={<span className="text-[11px] text-erp-muted">{lines.length} line{lines.length === 1 ? '' : 's'}</span>}
            >
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[960px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Finished Item</th>
                      <th>Required Qty</th>
                      <th>Available Stock</th>
                      <th>Shortage Qty</th>
                      <th>Suggested Production Qty</th>
                      <th>Due Date</th>
                      <th>BOM Status</th>
                      <th>Material Readiness</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const shortage = Math.max(0, line.demandQuantity - line.availableFinishedStock)
                      const suggested = shortage
                      return (
                        <tr key={line.key}>
                          <td className="min-w-[200px]">
                            <Select
                              value={line.finishedItemId}
                              onChange={(e) => pickItem(line.key, e.target.value)}
                            >
                              <option value="">Select…</option>
                              {FINISHED_ITEMS.map((f) => (
                                <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                              ))}
                            </Select>
                          </td>
                          <td>
                            <Input
                              type="number"
                              min={0.001}
                              className="w-24"
                              value={line.demandQuantity}
                              onChange={(e) => updateLine(line.key, { demandQuantity: Number(e.target.value) })}
                            />
                          </td>
                          <td>
                            <Input
                              type="number"
                              min={0}
                              className="w-24"
                              value={line.availableFinishedStock}
                              onChange={(e) => updateLine(line.key, { availableFinishedStock: Number(e.target.value) })}
                            />
                          </td>
                          <td className="tabular-nums font-semibold text-rose-700">{shortage}</td>
                          <td className="tabular-nums font-semibold">{suggested}</td>
                          <td>
                            <Input
                              type="date"
                              className="w-36"
                              value={line.requiredDate}
                              onChange={(e) => updateLine(line.key, { requiredDate: e.target.value })}
                            />
                          </td>
                          <td>
                            <Select
                              value={line.bomStatus}
                              onChange={(e) => updateLine(line.key, { bomStatus: e.target.value as BomReadinessStatus })}
                            >
                              {(Object.keys(BOM_READINESS_LABELS) as BomReadinessStatus[]).map((s) => (
                                <option key={s} value={s}>{BOM_READINESS_LABELS[s]}</option>
                              ))}
                            </Select>
                          </td>
                          <td>
                            <Select
                              value={line.materialStatus}
                              onChange={(e) => updateLine(line.key, { materialStatus: e.target.value as MaterialAvailabilityStatus })}
                            >
                              {(Object.keys(MATERIAL_STATUS_LABELS) as MaterialAvailabilityStatus[]).map((s) => (
                                <option key={s} value={s}>{MATERIAL_STATUS_LABELS[s]}</option>
                              ))}
                            </Select>
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="erp-btn erp-btn-secondary mt-3 inline-flex h-9 items-center gap-2 px-3 text-[13px]"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add Line
              </button>
              <p className="mt-2 text-[11px] text-erp-muted">
                Method default: {PRODUCTION_METHOD_LABELS.in_house}. Create WO actions are on the plan detail after save.
              </p>
            </ErpCardSection>
          </div>

          <ManufacturingAiAssist title="Planning AI Insights" suggestions={aiSuggestions} />
        </div>
      </div>
    </OperationalPageShell>
  )
}
