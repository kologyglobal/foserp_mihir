import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Factory } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  convertSalesOrderLine,
  createManualWorkOrder,
  getProfileReadiness,
  getSalesOrderLineEligibility,
  listEligibleSalesOrders,
  listProfiles,
} from '@/services/api/manufacturingApi'
import type { EligibleSalesOrder, SalesOrderLineEligibility } from '@/types/manufacturingProduction'
import { PRODUCTION_PRIORITY_LABELS, PRODUCTION_PRIORITY_VALUES } from '@/types/manufacturingProduction'
import type { ProductionPriority } from '@/types/manufacturingProduction'
import type { Profile, ProfileReadiness } from '@/types/manufacturingSetup'
import { useSetupLookup } from '../setup/useSetupLookups'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { ProductionPageHeader, ReadinessChecklist, type ReadinessItem } from '../ui'

type CreateMode = 'manual' | 'sales_order'

const today = () => new Date().toISOString().slice(0, 10)
const defaultDue = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

/**
 * Manufacturing Readiness context panel — server-derived profile readiness for
 * the selected product ("Recommended from Manufacturing Profile").
 */
function ManufacturingReadinessPanel({ productItemId }: { productItemId: string }) {
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [readiness, setReadiness] = useState<ProfileReadiness | null>(null)

  useEffect(() => {
    if (!productItemId) {
      setProfile(null)
      setReadiness(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await listProfiles({ productItemId, status: 'ACTIVE', limit: 1 })
        const found = res.data[0] ?? null
        if (cancelled) return
        setProfile(found)
        if (found) {
          const r = await getProfileReadiness(found.id)
          if (!cancelled) setReadiness(r.data)
        } else {
          setReadiness(null)
        }
      } catch {
        if (!cancelled) {
          setProfile(null)
          setReadiness(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productItemId])

  if (!productItemId) {
    return (
      <div className="rounded-lg border border-erp-border bg-white p-4 text-[12px] text-erp-muted">
        Select a product to check manufacturing readiness — profile, BOM, routing and warehouses.
      </div>
    )
  }
  if (loading) return <LoadingState variant="card" />
  if (!profile) {
    return (
      <ReadinessChecklist
        title="Manufacturing Readiness"
        items={[
          {
            id: 'profile',
            label: 'Manufacturing Profile',
            state: 'missing',
            detail: 'No active profile for this product. Create one under Setup → Profiles before release.',
          },
        ]}
      />
    )
  }

  const checks = readiness?.checks
  const items: ReadinessItem[] = [
    {
      id: 'profile',
      label: 'Manufacturing Profile',
      state: 'ready',
      detail: `${profile.code} — ${profile.name} (recommended)`,
    },
    {
      id: 'bom',
      label: 'BOM Version',
      state: checks?.hasDefaultBomVersion && checks.defaultBomVersionActive ? 'ready' : 'missing',
      detail: checks?.hasDefaultBomVersion
        ? checks.defaultBomVersionActive
          ? 'Active default version will be snapshotted at release.'
          : 'Default BOM version is not active.'
        : 'No default BOM version configured.',
    },
    {
      id: 'routing',
      label: 'Routing Version',
      state: checks?.hasDefaultRoutingVersion && checks.defaultRoutingVersionActive ? 'ready' : 'missing',
      detail: checks?.hasDefaultRoutingVersion
        ? checks.defaultRoutingVersionActive
          ? 'Active default version will be snapshotted at release.'
          : 'Default routing version is not active.'
        : 'No default routing version configured.',
    },
    {
      id: 'rm-warehouse',
      label: 'Raw Material Warehouse',
      state: checks?.hasProductionWarehouse ? 'ready' : 'missing',
    },
    {
      id: 'wip-warehouse',
      label: 'WIP Warehouse',
      state: checks?.hasWipWarehouse ? 'ready' : 'missing',
    },
    {
      id: 'fg-warehouse',
      label: 'Finished Goods Warehouse',
      state: checks?.hasFinishedGoodsWarehouse ? 'ready' : 'missing',
    },
  ]
  return (
    <div className="space-y-2">
      <ReadinessChecklist title="Manufacturing Readiness" items={items} />
      {readiness && !readiness.ready ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          You can still create a draft work order — missing setup blocks release, not draft creation.
        </p>
      ) : null}
    </div>
  )
}

/** Create Work Order — Manual entry, or convert a confirmed sales order line (Phase 2A). */
export function ApiWorkOrderCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useManufacturingWorkOrderPermissions()
  const { options: items } = useSetupLookup('items')
  const initialMode: CreateMode = searchParams.get('mode') === 'sales_order' ? 'sales_order' : 'manual'
  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [saving, setSaving] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const [productItemId, setProductItemId] = useState('')
  const [plannedQuantity, setPlannedQuantity] = useState('1')
  const [requiredCompletionDate, setRequiredCompletionDate] = useState(defaultDue())
  const [plannedStartDate, setPlannedStartDate] = useState(today())
  const [priority, setPriority] = useState<ProductionPriority>('MEDIUM')
  const [jobNumber, setJobNumber] = useState('')
  const [notes, setNotes] = useState('')

  const [salesOrders, setSalesOrders] = useState<EligibleSalesOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState('')
  const [lines, setLines] = useState<SalesOrderLineEligibility[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState('')
  const [convertQty, setConvertQty] = useState('')
  const [convertDue, setConvertDue] = useState('')

  useEffect(() => {
    if (mode !== 'sales_order' || salesOrders.length > 0) return
    setLoadingOrders(true)
    listEligibleSalesOrders()
      .then((res) => setSalesOrders(res.data))
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load sales orders'))
      .finally(() => setLoadingOrders(false))
  }, [mode, salesOrders.length])

  const loadLines = useCallback((salesOrderId: string) => {
    setSelectedSalesOrderId(salesOrderId)
    setSelectedLineId('')
    setLines([])
    if (!salesOrderId) return
    setLoadingLines(true)
    getSalesOrderLineEligibility(salesOrderId)
      .then((res) => setLines(res.data.lines))
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load sales order lines'))
      .finally(() => setLoadingLines(false))
  }, [])

  const selectedLine = lines.find((l) => l.lineId === selectedLineId)

  useEffect(() => {
    if (!selectedLine) return
    setConvertQty(String(Number(selectedLine.remainingQuantity) || selectedLine.qty))
    setConvertDue(defaultDue())
  }, [selectedLine])

  const submitManual = async () => {
    if (!productItemId || Number(plannedQuantity) <= 0 || !requiredCompletionDate) {
      notify.error('Product, planned quantity, and required completion date are required')
      return
    }
    setSaving(true)
    try {
      const res = await createManualWorkOrder({
        productItemId,
        plannedQuantity: Number(plannedQuantity),
        requiredCompletionDate,
        plannedStartDate: plannedStartDate || undefined,
        priority,
        jobNumber: jobNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success('Work order created')
      navigate(`/manufacturing/work-orders/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create work order')
    } finally {
      setSaving(false)
    }
  }

  const submitConversion = async () => {
    if (!selectedSalesOrderId || !selectedLine || Number(convertQty) <= 0) {
      notify.error('Select an eligible sales order line and enter a quantity')
      return
    }
    if (!selectedLine.eligible) {
      notify.error('This line is not eligible for conversion')
      return
    }
    setSaving(true)
    try {
      const res = await convertSalesOrderLine(selectedSalesOrderId, selectedLine.lineId, {
        quantity: Number(convertQty),
        requiredDate: convertDue || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success('Sales order line converted to a work order')
      navigate(`/manufacturing/work-orders/${res.data.order.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Conversion failed')
    } finally {
      setSaving(false)
    }
  }

  if (!perms.canCreateWo) {
    return (
      <ProductionPageHeader title="New Work Order" backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}>
        <EmptyState icon={Factory} title="Access denied" description="Missing work order create permission." />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="New Work Order"
      description="Create manually, or convert a confirmed sales order line into production."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: 'New' },
      ]}
      backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}
      primaryAction={{
        id: 'create',
        label: saving ? 'Working…' : 'Create Work Order',
        icon: CheckCircle2,
        onClick: () => void (mode === 'manual' ? submitManual() : submitConversion()),
        disabled: saving,
      }}
      secondaryActions={[{ id: 'cancel', label: 'Cancel', onClick: () => navigate('/manufacturing/work-orders') }]}
    >
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
        <div className="flex gap-1 rounded-lg border border-erp-border bg-white p-1" role="tablist" aria-label="Work order source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition',
              mode === 'manual' ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
            )}
          >
            Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sales_order'}
            onClick={() => setMode('sales_order')}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition',
              mode === 'sales_order' ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
            )}
          >
            From Sales Order
          </button>
        </div>

        {mode === 'manual' ? (
          <div className="space-y-3">
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-erp-text">Product & quantity</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label="Product Item"
                  required
                  hint={items.length === 0 ? 'Item lookup unavailable — check API connectivity.' : undefined}
                >
                  <Select value={productItemId} onChange={(e) => setProductItemId(e.target.value)}>
                    <option value="">Select item…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Planned Quantity" required>
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={plannedQuantity}
                    onChange={(e) => setPlannedQuantity(e.target.value)}
                  />
                </FormField>
                <FormField label="Planned Start Date">
                  <Input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} />
                </FormField>
                <FormField label="Required Completion Date" required>
                  <Input
                    type="date"
                    value={requiredCompletionDate}
                    onChange={(e) => setRequiredCompletionDate(e.target.value)}
                  />
                </FormField>
                <FormField label="Priority">
                  <Select value={priority} onChange={(e) => setPriority(e.target.value as ProductionPriority)}>
                    {PRODUCTION_PRIORITY_VALUES.map((p) => (
                      <option key={p} value={p}>
                        {PRODUCTION_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-erp-text"
                onClick={() => setShowOptional((v) => !v)}
                aria-expanded={showOptional}
              >
                Optional details
                <span className="text-[11px] font-medium text-erp-muted">{showOptional ? 'Hide' : 'Show'}</span>
              </button>
              {showOptional ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FormField label="Job Number">
                    <Input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
                  </FormField>
                  <FormField label="Notes" className="sm:col-span-2">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </FormField>
                </div>
              ) : null}
              <p className="mt-3 text-[12px] text-erp-muted">
                Manual creation requires the product&apos;s manufacturing profile to allow direct work orders. Release
                snapshots the active BOM &amp; routing onto this work order.
              </p>
            </section>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="rounded-lg border border-erp-border bg-white p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-erp-text">1. Select sales order</h2>
              <FormField label="Sales Order" required hint="Only confirmed / in-production sales orders are eligible.">
                {loadingOrders ? (
                  <p className="text-[12px] text-erp-muted">Loading sales orders…</p>
                ) : (
                  <Select value={selectedSalesOrderId} onChange={(e) => loadLines(e.target.value)}>
                    <option value="">Select sales order…</option>
                    {salesOrders.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.salesOrderNo} · {so.lineCount} line(s)
                      </option>
                    ))}
                  </Select>
                )}
                {!loadingOrders && salesOrders.length === 0 ? (
                  <p className="mt-1 text-[12px] text-erp-muted">No confirmed / in-production sales orders found.</p>
                ) : null}
              </FormField>
            </div>

            {selectedSalesOrderId ? (
              <div className="rounded-lg border border-erp-border bg-white p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-erp-text">2. Choose line</h2>
                {loadingLines ? (
                  <LoadingState variant="table" rows={3} />
                ) : lines.length === 0 ? (
                  <p className="text-[13px] text-erp-muted">No lines found on this sales order.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="erp-table w-full text-[12px]">
                      <thead>
                        <tr>
                          <th />
                          <th>Line</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Remaining</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.lineId} className={cn(!line.eligible && 'opacity-60')}>
                            <td>
                              <input
                                type="radio"
                                name="line"
                                disabled={!line.eligible}
                                checked={selectedLineId === line.lineId}
                                onChange={() => setSelectedLineId(line.lineId)}
                              />
                            </td>
                            <td>
                              <div className="font-medium">{line.productOrItem || line.resolvedItemCode || '—'}</div>
                              {line.description ? <div className="text-erp-muted">{line.description}</div> : null}
                            </td>
                            <td className="text-right tabular-nums">
                              {line.qty} {line.uom}
                            </td>
                            <td className="text-right tabular-nums">{line.remainingQuantity}</td>
                            <td>
                              {line.eligible ? (
                                <span className="font-semibold text-emerald-700">Eligible</span>
                              ) : (
                                <span className="font-semibold text-rose-700" title={line.reasons.join('; ')}>
                                  Blocked
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {selectedLine ? (
              <div className="rounded-lg border border-erp-border bg-white p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-erp-text">3. Convert quantity</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Quantity to Convert" required>
                    <Input type="number" min={0.001} step="any" value={convertQty} onChange={(e) => setConvertQty(e.target.value)} />
                  </FormField>
                  <FormField label="Required Date">
                    <Input type="date" value={convertDue} onChange={(e) => setConvertDue(e.target.value)} />
                  </FormField>
                </div>
                {!selectedLine.eligible ? (
                  <p className="mt-2 text-[12px] font-medium text-rose-700">{selectedLine.reasons.join('; ')}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
        </div>
        <div className="space-y-3 lg:col-span-4">
          <ManufacturingReadinessPanel
            productItemId={mode === 'manual' ? productItemId : (selectedLine?.resolvedItemId ?? '')}
          />
          <div className="rounded-lg border border-erp-border bg-white p-4 text-[12px] text-erp-muted">
            <p className="font-semibold text-erp-text">What happens next</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-1">
              <li>Draft is created — nothing is reserved or posted.</li>
              <li>Release snapshots the active BOM and routing (immutable).</li>
              <li>Material requirements sync for reservation and issue.</li>
              <li>Start production once readiness passes.</li>
            </ol>
          </div>
        </div>
      </div>
    </ProductionPageHeader>
  )
}
