import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Layers, Pencil, Power, PowerOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { TableLink } from '@/components/ui/AppLink'
import {
  activateBom,
  deactivateBom,
  duplicateBom,
  getBomById,
  getBomCostPreview,
  getBomWhereUsed,
  getManufacturingAuditTrail,
} from '@/services/manufacturing'
import type {
  BillOfMaterial,
  BomCostPreview,
  BomWhereUsedRow,
  ManufacturingAuditEntry,
} from '@/types/manufacturing'
import {
  BOM_ISSUE_METHOD_LABELS,
  BOM_STATUS_LABELS,
  PRODUCTION_METHOD_LABELS,
} from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { BomTravelerPreviewTable } from '@/components/bom/BomTravelerPreviewTable'
import { getTravelerDocumentForManufacturingBom } from '@/data/bom/isoTravelerBomSeed'
import { cn } from '@/utils/cn'

type DetailTab = 'overview' | 'traveler' | 'components' | 'cost' | 'where_used' | 'timeline'

const BASE_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'components', label: 'Components' },
  { id: 'cost', label: 'Cost Estimate' },
  { id: 'where_used', label: 'Where Used' },
  { id: 'timeline', label: 'Timeline' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{children}</dd>
    </div>
  )
}

export function BomDetailPage() {
  const { bomId } = useParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<DetailTab>('overview')
  const [bom, setBom] = useState<BillOfMaterial | null>(null)
  const [costPreview, setCostPreview] = useState<BomCostPreview | null>(null)
  const [whereUsed, setWhereUsed] = useState<BomWhereUsedRow[]>([])
  const [timeline, setTimeline] = useState<ManufacturingAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!bomId) return
    setLoading(true)
    const row = await getBomById(bomId)
    if (!row) {
      notify.error('BOM not found')
      navigate('/manufacturing/bom')
      return
    }
    setBom(row)
    const [cost, used, audit] = await Promise.all([
      perms.canViewCost ? getBomCostPreview(row.id) : Promise.resolve(null),
      getBomWhereUsed(row.id),
      getManufacturingAuditTrail(row.id),
    ])
    setCostPreview(cost)
    setWhereUsed(used)
    setTimeline(audit)
    setLoading(false)
  }, [bomId, navigate, perms.canViewCost])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (
    action: () => Promise<{ ok: true; bom: BillOfMaterial } | { ok: false; error: string }>,
    success: string,
    goEdit?: boolean,
  ) => {
    setBusy(true)
    try {
      const r = await action()
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success(success)
      if (goEdit) navigate(`/manufacturing/bom/${r.bom.id}/edit`)
      else if (r.bom.id !== bomId) navigate(`/manufacturing/bom/${r.bom.id}`)
      else await load()
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewBom) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="BOM"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'BOM', to: '/manufacturing/bom' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={Layers} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading || !bom) return <LoadingState variant="card" />

  const travelerDoc = getTravelerDocumentForManufacturingBom(bom.id)
  const tabs = travelerDoc
    ? [
        BASE_TABS[0],
        { id: 'traveler' as const, label: 'Traveler' },
        ...BASE_TABS.slice(1),
      ]
    : BASE_TABS

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={bom.bomNumber}
      description={`${bom.finishedItemCode} · ${bom.finishedItemName} · ${bom.version}`}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'BOM', to: '/manufacturing/bom' },
        { label: bom.bomNumber },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/bom/${bom.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canEditBom
              ? {
                  id: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => navigate(`/manufacturing/bom/${bom.id}/edit`),
                  disabled: busy || bom.status === 'active',
                }
              : undefined
          }
          secondaryActions={[
            ...(travelerDoc
              ? [
                  {
                    id: 'traveler',
                    label: 'Open Traveler',
                    icon: Layers,
                    onClick: () => setTab('traveler'),
                  },
                ]
              : []),
            ...(perms.canActivateBom && bom.status !== 'active'
              ? [{ id: 'activate', label: 'Activate', icon: Power, onClick: () => void run(() => activateBom(bom.id), 'BOM activated'), disabled: busy }]
              : []),
            ...(perms.canDeactivateBom && bom.status === 'active'
              ? [{ id: 'deactivate', label: 'Deactivate', icon: PowerOff, onClick: () => void run(() => deactivateBom(bom.id), 'BOM deactivated'), disabled: busy }]
              : []),
            ...(perms.canCreateBom
              ? [{ id: 'dup', label: 'Duplicate', icon: Copy, onClick: () => void run(() => duplicateBom(bom.id), 'BOM duplicated', true), disabled: busy }]
              : []),
          ]}
        />
      )}
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner
          message={
            travelerDoc
              ? 'ISO traveler BOM — material lines for WO; Traveler tab keeps process (PROC) rows for preview.'
              : 'BOM detail is demo data — Work Orders link here when production starts.'
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusDot label={BOM_STATUS_LABELS[bom.status]} tone={statusToneFromLabel(bom.status)} />
          <span className="text-[12px] text-erp-muted">
            {bom.componentCount} component{bom.componentCount === 1 ? '' : 's'} · Updated {formatDate(bom.updatedAt.slice(0, 10))}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="BOM detail tabs"
          className="flex flex-wrap gap-1 rounded-xl border border-erp-border bg-white p-1"
        >
          {tabs.map((t) => {
            const selected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold transition',
                  selected ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'overview' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Finished Item">{bom.finishedItemCode} — {bom.finishedItemName}</Field>
              <Field label="BOM Version">{bom.version}</Field>
              <Field label="Status">
                <StatusDot label={BOM_STATUS_LABELS[bom.status]} tone={statusToneFromLabel(bom.status)} />
              </Field>
              <Field label="Quantity Basis">{bom.productionQuantity} {bom.baseUom}</Field>
              <Field label="Production Method">{PRODUCTION_METHOD_LABELS[bom.productionMethod]}</Field>
              <Field label="Default Warehouse">{bom.defaultMaterialWarehouseName}</Field>
              <Field label="QC Required">{bom.qualityRequired ? 'Yes' : 'No'}</Field>
              <Field label="Auto Consumption">{bom.autoConsumption ? 'Yes' : 'No'}</Field>
              <Field label="Components">{bom.componentCount}</Field>
              <Field label="Created By">{bom.createdBy}</Field>
              <Field label="Last Updated">{formatDate(bom.updatedAt.slice(0, 10))}</Field>
              <Field label="Created">{formatDate(bom.createdAt.slice(0, 10))}</Field>
            </dl>
          </section>
        ) : null}

        {tab === 'traveler' && travelerDoc ? (
          <div className="space-y-2">
            <p className="text-[12px] text-erp-muted">
              Full traveler sheet (assemblies + PROC). Material Components tab is what Work Orders explode.
            </p>
            <BomTravelerPreviewTable document={travelerDoc} />
          </div>
        ) : null}

        {tab === 'components' ? (
          <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Raw Material Item</th>
                    <th className="text-right">Required Qty</th>
                    <th>UOM</th>
                    <th className="text-right">Wastage %</th>
                    <th>Source Warehouse</th>
                    <th>Issue Method</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="tabular-nums">{line.lineNo}</td>
                      <td>
                        <div className="font-mono">{line.componentItemCode}</div>
                        <div className="text-erp-muted">{line.componentItemName}</div>
                      </td>
                      <td className="text-right tabular-nums">{line.requiredQuantity}</td>
                      <td>{line.uom}</td>
                      <td className="text-right tabular-nums">{line.scrapPercent}</td>
                      <td>{line.warehouseName}</td>
                      <td>{BOM_ISSUE_METHOD_LABELS[line.issueMethod ?? 'auto']}</td>
                      <td className="text-erp-muted">{line.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'cost' ? (
          perms.canViewCost && costPreview ? (
            <section className="max-w-md rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Cost Estimate</h3>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between"><dt className="text-erp-muted">Material</dt><dd className="tabular-nums">{formatCurrency(costPreview.materialCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Labour</dt><dd className="tabular-nums">{formatCurrency(costPreview.estimatedLabourCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Machine</dt><dd className="tabular-nums">{formatCurrency(costPreview.estimatedMachineCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Job Work</dt><dd className="tabular-nums">{formatCurrency(costPreview.jobWorkCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Overhead</dt><dd className="tabular-nums">{formatCurrency(costPreview.overhead)}</dd></div>
                <div className="flex justify-between border-t border-erp-border pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(costPreview.totalEstimatedCost)}</dd>
                </div>
                <div className="flex justify-between text-erp-muted">
                  <dt>Per unit</dt>
                  <dd className="tabular-nums">{formatCurrency(costPreview.estimatedCostPerUnit)}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-erp-border p-6 text-[13px] text-erp-muted">
              {perms.canViewCost ? 'No cost estimate available.' : 'Cost estimate hidden by permission.'}
            </p>
          )
        ) : null}

        {tab === 'where_used' ? (
          <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
            {whereUsed.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-erp-muted">Not linked to work orders or other versions yet.</p>
            ) : (
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Document Type</th>
                    <th>Document No</th>
                    <th>Status</th>
                    <th className="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {whereUsed.map((row) => (
                    <tr key={`${row.documentType}-${row.id}`}>
                      <td>{row.documentType}</td>
                      <td>
                        <TableLink to={row.href} className="font-semibold">
                          {row.documentNo}
                        </TableLink>
                      </td>
                      <td className="capitalize">{row.status.replace(/_/g, ' ')}</td>
                      <td className="text-right tabular-nums">{row.qty ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        {tab === 'timeline' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {timeline.length === 0 ? (
              <p className="text-center text-[13px] text-erp-muted">No timeline events yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map((ev) => (
                  <li key={ev.id} className="flex gap-3 border-b border-erp-border/70 pb-3 last:border-0 last:pb-0">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-erp-primary" />
                    <div>
                      <p className="text-[13px] font-semibold text-erp-text">{ev.action}</p>
                      <p className="text-[12px] text-erp-muted">
                        {ev.userName} · {formatDate(ev.at.slice(0, 10))}
                        {ev.remarks ? ` · ${ev.remarks}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
