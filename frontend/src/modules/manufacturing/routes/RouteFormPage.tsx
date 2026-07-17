import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Route as RouteIcon } from 'lucide-react'
import {
  createManufacturingRoute,
  getManufacturingRouteById,
  updateManufacturingRoute,
} from '@/services/manufacturing'
import { seedManufacturingBoms } from '@/data/manufacturing/seed'
import type { CreateManufacturingRouteInput, ManufacturingRouteOperationLine, QtyBasis } from '@/types/manufacturingRoute'
import { QTY_BASIS_LABELS } from '@/types/manufacturingRoute'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

type OpDraft = Omit<ManufacturingRouteOperationLine, 'id'> & { id?: string; key: string }

const FINISHED = Array.from(
  new Map(seedManufacturingBoms.map((b) => [b.finishedItemId, b])).values(),
)

function emptyOp(seq: number): OpDraft {
  return {
    key: crypto.randomUUID(),
    sequenceNo: seq,
    operationName: '',
    workCenter: '',
    plannedTimeMinutes: 60,
    qcRequired: false,
    jobWorkRequired: false,
    inputQtyBasis: 'wo_planned',
    outputQtyBasis: 'wo_planned',
    allowScrap: true,
    allowRework: true,
    allowReject: true,
  }
}

export function RouteFormPage() {
  const { routeId } = useParams()
  const isEdit = Boolean(routeId)
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [finishedItemId, setFinishedItemId] = useState(FINISHED[0]?.finishedItemId ?? '')
  const [version, setVersion] = useState('v1')
  const [remarks, setRemarks] = useState('')
  const [ops, setOps] = useState<OpDraft[]>([emptyOp(10), emptyOp(20)])

  useEffect(() => {
    if (!routeId) return
    void (async () => {
      setLoading(true)
      const r = await getManufacturingRouteById(routeId)
      if (!r) {
        notify.error('Route not found')
        navigate('/manufacturing/routes')
        return
      }
      setRouteName(r.routeName)
      setFinishedItemId(r.finishedItemId)
      setVersion(r.version)
      setRemarks(r.remarks ?? '')
      setOps(r.operations.map((o) => ({ ...o, key: o.id })))
      setLoading(false)
    })()
  }, [navigate, routeId])

  const item = FINISHED.find((b) => b.finishedItemId === finishedItemId)

  const buildInput = (): CreateManufacturingRouteInput => ({
    routeName,
    finishedItemId: item?.finishedItemId ?? finishedItemId,
    finishedItemCode: item?.finishedItemCode ?? '',
    finishedItemName: item?.finishedItemName ?? '',
    version,
    defaultBomId: item?.id ?? null,
    defaultBomNumber: item?.bomNumber ?? '',
    remarks,
    operations: ops.map(({ key: _k, ...o }) => o),
  })

  const save = async () => {
    if (!perms.canCreateRoute && !perms.canEditRoute) {
      notify.error('Permission denied')
      return
    }
    if (!routeName.trim()) { notify.error('Route name required'); return }
    if (ops.some((o) => !o.operationName.trim())) { notify.error('Each operation needs a name'); return }
    setBusy(true)
    try {
      const r = isEdit && routeId
        ? await updateManufacturingRoute(routeId, buildInput())
        : await createManufacturingRoute(buildInput())
      if (!r.ok || !r.route) {
        notify.error(r.error ?? 'Save failed')
        return
      }
      notify.success(isEdit ? 'Route updated' : 'Route created')
      navigate(`/manufacturing/routes/${r.route.id}`)
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canCreateRoute && !isEdit) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Manufacturing" title="New Route">
        <EmptyState icon={RouteIcon} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={isEdit ? 'Edit Route' : 'New Route'}
      description="Attach this template to a Finished Item (and its default BOM). Activate once — every new Work Order for that item snapshots these stages."
      breadcrumbs={[
        { label: 'Manufacturing', to: '/manufacturing' },
        { label: 'Routes', to: '/manufacturing/routes' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'save', label: 'Save', onClick: () => void save(), disabled: busy }}
          secondaryActions={[{ id: 'back', label: 'Cancel', onClick: () => navigate('/manufacturing/routes') }]}
        />
      )}
    >
      <ManufacturingDemoBanner message="Save as Draft, then Activate. Work Orders copy this route — they never edit the master. Status: Draft → Active → Inactive." />
      <div className="grid max-w-3xl gap-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
        <FormField label="Route Name" required>
          <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Tank Assembly Route" />
        </FormField>
        <FormField label="Finished Item (attach template)" required>
          <Select value={finishedItemId} onChange={(e) => setFinishedItemId(e.target.value)}>
            {FINISHED.map((b) => (
              <option key={b.finishedItemId} value={b.finishedItemId}>
                {b.finishedItemCode} — {b.finishedItemName}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Version">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1" />
          </FormField>
          <FormField label="Default BOM (auto from item)">
            <Input value={item ? `${item.bomNumber}` : '—'} disabled />
          </FormField>
        </div>
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Operation lines (template)</h3>
            <p className="text-[12px] text-erp-muted">
              Sequence · Name · Work Center · Planned Time · QC · Job Work · Vendor · Remarks
            </p>
          </div>
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]"
            onClick={() => setOps((prev) => [...prev, emptyOp((prev.length + 1) * 10)])}
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Add operation
          </button>
        </div>
        {ops.map((op, idx) => (
          <div key={op.key} className="rounded-xl border border-erp-border bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-erp-muted">Seq {op.sequenceNo}</span>
              <button
                type="button"
                className="text-rose-600 hover:underline"
                disabled={ops.length <= 1}
                onClick={() => setOps((prev) => prev.filter((x) => x.key !== op.key))}
              >
                <Trash2 className="inline h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Sequence">
                <Input
                  type="number"
                  value={op.sequenceNo}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, sequenceNo: v } : x)))
                  }}
                />
              </FormField>
              <FormField label="Operation Name" required>
                <Input
                  value={op.operationName}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, operationName: e.target.value } : x)))}
                  placeholder="Cutting"
                />
              </FormField>
              <FormField label="Work Center / Area">
                <Input
                  value={op.workCenter}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, workCenter: e.target.value } : x)))}
                />
              </FormField>
              <FormField label="Planned Time (min)">
                <Input
                  type="number"
                  value={op.plannedTimeMinutes}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, plannedTimeMinutes: Number(e.target.value) } : x)))}
                />
              </FormField>
              <FormField label="Input Qty Basis">
                <Select
                  value={op.inputQtyBasis}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, inputQtyBasis: e.target.value as QtyBasis } : x)))}
                >
                  {(Object.keys(QTY_BASIS_LABELS) as QtyBasis[]).map((k) => (
                    <option key={k} value={k}>{QTY_BASIS_LABELS[k]}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Output Qty Basis">
                <Select
                  value={op.outputQtyBasis}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, outputQtyBasis: e.target.value as QtyBasis } : x)))}
                >
                  {(Object.keys(QTY_BASIS_LABELS) as QtyBasis[]).map((k) => (
                    <option key={k} value={k}>{QTY_BASIS_LABELS[k]}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={op.qcRequired} onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, qcRequired: e.target.checked } : x)))} />
                QC Required
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={op.jobWorkRequired} onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, jobWorkRequired: e.target.checked } : x)))} />
                Job Work
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={op.allowScrap} onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, allowScrap: e.target.checked } : x)))} />
                Allow Scrap
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={op.allowRework} onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, allowRework: e.target.checked } : x)))} />
                Allow Rework
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={op.allowReject} onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, allowReject: e.target.checked } : x)))} />
                Allow Reject
              </label>
            </div>
            {op.jobWorkRequired ? (
              <FormField label="Default Vendor" className="mt-2">
                <Input
                  value={op.defaultVendorName ?? ''}
                  onChange={(e) => setOps((prev) => prev.map((x, i) => (i === idx ? { ...x, defaultVendorName: e.target.value } : x)))}
                  placeholder="Vendor name"
                />
              </FormField>
            ) : null}
          </div>
        ))}
      </div>
    </OperationalPageShell>
  )
}
