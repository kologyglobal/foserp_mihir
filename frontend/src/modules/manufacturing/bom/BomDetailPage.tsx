import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, FilePlus2, Layers, Pencil, Power, PowerOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  activateBom,
  createBomVersion,
  deactivateBom,
  duplicateBom,
  getBomById,
  getBomCostPreview,
} from '@/services/manufacturing'
import type { BillOfMaterial, BomCostPreview } from '@/types/manufacturing'
import {
  BOM_STATUS_LABELS,
  PRODUCTION_METHOD_LABELS,
  SUPPLY_METHOD_LABELS,
} from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-erp-text">{children}</dd>
    </div>
  )
}

export function BomDetailPage() {
  const { bomId } = useParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [bom, setBom] = useState<BillOfMaterial | null>(null)
  const [costPreview, setCostPreview] = useState<BomCostPreview | null>(null)
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
    if (perms.canViewCost) setCostPreview(await getBomCostPreview(row.id))
    else setCostPreview(null)
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
            ...(perms.canActivateBom && bom.status !== 'active'
              ? [{ id: 'activate', label: 'Activate', icon: Power, onClick: () => void run(() => activateBom(bom.id), 'BOM activated'), disabled: busy }]
              : []),
            ...(perms.canDeactivateBom && bom.status === 'active'
              ? [{ id: 'deactivate', label: 'Deactivate', icon: PowerOff, onClick: () => void run(() => deactivateBom(bom.id), 'BOM deactivated'), disabled: busy }]
              : []),
            ...(perms.canCreateBom
              ? [
                  { id: 'version', label: 'New Version', icon: FilePlus2, onClick: () => void run(() => createBomVersion(bom.id), 'New version created', true), disabled: busy },
                  { id: 'dup', label: 'Duplicate', icon: Copy, onClick: () => void run(() => duplicateBom(bom.id), 'BOM duplicated', true), disabled: busy },
                ]
              : []),
          ]}
        />
      )}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-erp-border bg-erp-surface p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">BOM Details</h3>
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <Field label="Finished Item">{bom.finishedItemCode} — {bom.finishedItemName}</Field>
            <Field label="Category">{bom.itemCategory}</Field>
            <Field label="Production Qty">{bom.productionQuantity} {bom.baseUom}</Field>
            <Field label="Production Method">{PRODUCTION_METHOD_LABELS[bom.productionMethod]}</Field>
            <Field label="Version">{bom.version}</Field>
            <Field label="Status">
              <StatusDot label={BOM_STATUS_LABELS[bom.status]} tone={statusToneFromLabel(bom.status)} />
            </Field>
            <Field label="Effective From">{formatDate(bom.effectiveFrom)}</Field>
            <Field label="Effective To">{bom.effectiveTo ? formatDate(bom.effectiveTo) : '—'}</Field>
            <Field label="Material Warehouse">{bom.defaultMaterialWarehouseName}</Field>
            <Field label="FG Warehouse">{bom.defaultFgWarehouseName}</Field>
            <Field label="Components">{bom.componentCount}</Field>
            <Field label="Created By">{bom.createdBy}</Field>
          </dl>
        </section>

        {perms.canViewCost && costPreview ? (
          <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Cost Preview</h3>
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
                <dt>Per Unit</dt>
                <dd className="tabular-nums">{formatCurrency(costPreview.estimatedCostPerUnit)}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-erp-border p-4 text-[13px] text-erp-muted">
            {perms.canViewCost ? 'No cost preview.' : 'Cost hidden by permission.'}
          </section>
        )}
      </div>

      <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Materials</h3>
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Component</th>
                <th className="text-right">Qty</th>
                <th>UOM</th>
                <th className="text-right">Scrap %</th>
                <th>Warehouse</th>
                <th>Supply</th>
                <th className="text-right">Available</th>
                {perms.canViewCost ? <th className="text-right">Est. Cost</th> : null}
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
                  <td>{SUPPLY_METHOD_LABELS[line.supplyMethod]}</td>
                  <td className="text-right tabular-nums">{line.availableStock}</td>
                  {perms.canViewCost ? (
                    <td className="text-right tabular-nums">{formatCurrency(line.estimatedCost)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </OperationalPageShell>
  )
}
