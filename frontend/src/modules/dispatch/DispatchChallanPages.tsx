import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, FileText, RefreshCw, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  approveDeliveryChallan,
  cancelDeliveryChallan,
  createDeliveryChallan,
  deliveryChallanPreviewUrl,
  getDeliveryChallan,
  issueDeliveryChallan,
  listDeliveryChallans,
  submitDeliveryChallan,
  updateDeliveryChallan,
  type DeliveryChallanRow,
} from '@/services/api/dispatchApi'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'

function ApiRequired({ title }: { title: string }) {
  return (
    <OperationalPageShell title={title} description="API mode required">
      <p className="text-sm text-muted-foreground">Enable VITE_USE_API to use Delivery Challans.</p>
    </OperationalPageShell>
  )
}

export function DispatchChallanRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DeliveryChallanRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { items } = await listDeliveryChallans({ limit: 100 })
      setRows(items)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load challans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode()) return <ApiRequired title="Delivery Challans" />

  return (
    <OperationalPageShell
      title="Delivery Challans"
      description="Document-only — Packed ≠ Dispatched. No stock posting."
      backLink={{ to: '/dispatch/workbench', label: 'Workbench' }}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Challan</th>
                <th className="p-2">Dispatch</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Status</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t hover:bg-muted/30"
                  onClick={() => navigate(`/dispatch/delivery-challans/${r.id}`)}
                >
                  <td className="p-2 font-medium">{r.challanNumber ?? `Draft v${r.versionNumber}`}</td>
                  <td className="p-2">{r.outboundDispatch?.dispatchNo ?? r.outboundDispatchId}</td>
                  <td className="p-2">{r.totalQuantity}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.documentDate}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    No delivery challans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}

export function DispatchChallanDetailPage() {
  const { id = '' } = useParams()
  const [row, setRow] = useState<DeliveryChallanRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [transport, setTransport] = useState({
    transporterName: '',
    vehicleNumber: '',
    lrGrNumber: '',
    eWayBillReference: '',
  })

  const load = useCallback(async () => {
    if (!isApiMode() || !id) return
    try {
      const data = await getDeliveryChallan(id)
      setRow(data)
      setTransport({
        transporterName: (data as { transporterName?: string | null }).transporterName ?? '',
        vehicleNumber: data.vehicleNumber ?? '',
        lrGrNumber: (data as { lrGrNumber?: string | null }).lrGrNumber ?? '',
        eWayBillReference: (data as { eWayBillReference?: string | null }).eWayBillReference ?? '',
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load challan')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      notify.success(label)
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) return <ApiRequired title="Delivery Challan" />
  if (!row) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Dispatch"
        title="Delivery Challan"
        backLink={{ to: '/dispatch/delivery-challans', label: 'Challans' }}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const editable = row.status === 'DRAFT' || row.status === 'SENT_BACK'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Dispatch"
      title={row.challanNumber ?? 'Delivery Challan Draft'}
      description={`Version ${row.versionNumber} · document only (no inventory movement on issue)`}
      showDescription
      backLink={{ to: '/dispatch/delivery-challans', label: 'Challans' }}
      actions={<DynamicsStatusChip label={row.status.replace(/_/g, ' ')} tone="info" />}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} disabled={busy} />
            <CommandBarButton
              icon={FileText}
              label="Preview"
              onClick={() => window.open(deliveryChallanPreviewUrl(row.id), '_blank')}
            />
            {editable ? (
              <CommandBarButton
                icon={Send}
                label="Submit for Review"
                primary
                disabled={busy}
                onClick={() =>
                  void act('Submitted for review', async () => {
                    await updateDeliveryChallan(row.id, transport)
                    await submitDeliveryChallan(row.id)
                  })
                }
              />
            ) : null}
            {row.status === 'READY_FOR_REVIEW' ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Approve"
                primary
                disabled={busy}
                onClick={() => void act('Approved', () => approveDeliveryChallan(row.id))}
              />
            ) : null}
            {row.status === 'APPROVED' || row.status === 'READY_FOR_REVIEW' ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Issue Challan"
                primary={row.status === 'APPROVED'}
                disabled={busy}
                onClick={() =>
                  void act('Challan issued — no stock movement', () =>
                    issueDeliveryChallan(row.id, { idempotencyKey: `issue-${row.id}` }),
                  )
                }
              />
            ) : null}
            {row.status !== 'CANCELLED' && row.status !== 'SUPERSEDED' ? (
              <CommandBarButton
                icon={FileText}
                label="Cancel"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const reason = await appPromptNote({
                      title: 'Cancel challan?',
                      description: `Cancel ${row.challanNumber ?? 'this delivery challan'}?`,
                      confirmLabel: 'Cancel challan',
                      tone: 'danger',
                      note: { required: true, label: 'Reason', placeholder: 'Cancellation reason' },
                    })
                    if (reason == null) return
                    await act('Cancelled', () => cancelDeliveryChallan(row.id, reason))
                  })()
                }}
              />
            ) : null}
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <StatusBadge status={row.status} />
        <span className="text-[12px] text-erp-muted">Document-only challan</span>
      </div>
      <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
        Issuing does not reduce inventory or update sales order fulfilment.
      </div>

      {editable ? (
        <div className="mb-4 grid gap-3 rounded border p-3 md:grid-cols-2">
          <label className="text-sm">
            Transporter
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={transport.transporterName}
              onChange={(e) => setTransport((t) => ({ ...t, transporterName: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Vehicle number
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={transport.vehicleNumber}
              onChange={(e) => setTransport((t) => ({ ...t, vehicleNumber: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            LR/GR
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={transport.lrGrNumber}
              onChange={(e) => setTransport((t) => ({ ...t, lrGrNumber: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            e-Way Bill (manual reference)
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={transport.eWayBillReference}
              onChange={(e) => setTransport((t) => ({ ...t, eWayBillReference: e.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div>Dispatch: {row.outboundDispatch?.dispatchNo ?? row.outboundDispatchId}</div>
        <div>Quantity: {row.totalQuantity}</div>
        <div>Packages: {row.totalPackages}</div>
        <div>Document date: {row.documentDate}</div>
        <div>
          Packing:{' '}
          <Link className="underline" to={`/dispatch/packing-sessions/${row.packingSessionId}`}>
            Open session
          </Link>
        </div>
        {row.status === 'ISSUED' ? (
          <div className="font-medium text-emerald-700">Ready for Dispatch Posting (Phase 7C5) — informational</div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}

export async function startChallanFromDispatch(dispatchId: string) {
  return createDeliveryChallan(dispatchId, {
    idempotencyKey: `wb-dc-${dispatchId}-${Date.now()}`,
  })
}
