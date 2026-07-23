/**
 * Proof of Delivery panel — logistics confirmation after posted Dispatch.
 * Does not move stock (FG already issued on post).
 */
import { useCallback, useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import {
  captureOutboundPod,
  getOutboundPod,
  markOutboundPodInTransit,
  type DispatchPodDto,
  type DispatchPodStatus,
  type OutboundDispatch,
} from '@/services/api/dispatchApi'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Select } from '@/components/forms/Inputs'

type Props = {
  detail: OutboundDispatch
  onChanged?: () => void
}

export function DispatchPodPanel({ detail, onChanged }: Props) {
  const [pod, setPod] = useState<DispatchPodDto | null>(null)
  const [stockNote, setStockNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [receiverName, setReceiverName] = useState('')
  const [receiverContact, setReceiverContact] = useState('')
  const [remarks, setRemarks] = useState('')
  const [status, setStatus] = useState<DispatchPodStatus | ''>('')

  const canPod = detail.status === 'CONFIRMED'

  const load = useCallback(async () => {
    if (!isApiMode() || !detail.id) return
    setLoading(true)
    try {
      const data = await getOutboundPod(detail.id)
      setPod(data.pod)
      setStockNote(data.stockNote)
      if (data.pod) {
        setReceiverName(data.pod.receiverName ?? '')
        setReceiverContact(data.pod.receiverContact ?? '')
        setRemarks(data.pod.deliveryRemarks ?? '')
        setStatus(data.pod.status)
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load POD')
    } finally {
      setLoading(false)
    }
  }, [detail.id])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode()) return null

  const onInTransit = async () => {
    if (!canPod) return
    setBusy(true)
    try {
      const row = await markOutboundPodInTransit(detail.id)
      setPod(row)
      notify.success('Marked in transit')
      onChanged?.()
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'In-transit failed')
    } finally {
      setBusy(false)
    }
  }

  const onCapture = async () => {
    if (!canPod) return
    const name =
      receiverName.trim() ||
      (await appPromptNote({
        title: 'Receiver name',
        description: 'Who received the goods?',
        confirmLabel: 'Continue',
        note: { required: true, label: 'Receiver name', placeholder: 'Name…' },
      }))
    if (!name?.trim()) return
    setBusy(true)
    try {
      const totalDispatched = (detail.lines ?? []).reduce((s, l) => s + Number(l.quantity), 0)
      const row = await captureOutboundPod(detail.id, {
        status: status || 'DELIVERED',
        receiverName: name.trim(),
        receiverContact: receiverContact.trim() || undefined,
        deliveryAddress: detail.shipToAddress ?? undefined,
        deliveryRemarks: remarks.trim() || undefined,
        quantityDelivered: totalDispatched,
        quantityDamaged: 0,
        quantityShort: 0,
        lines: (detail.lines ?? []).map((l) => ({
          outboundDispatchLineId: l.id,
          deliveredQty: Number(l.quantity),
          damagedQty: 0,
          shortQty: 0,
        })),
      })
      setPod(row)
      notify.success(`POD ${row.status.replace(/_/g, ' ')}`)
      onChanged?.()
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Capture POD failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border border-erp-border bg-white p-3 text-sm">
      <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Proof of Delivery</h3>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {stockNote ||
          'POD confirms customer receipt. Stock was already issued when Dispatch was posted.'}
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading POD…</p>
      ) : (
        <>
          <div className="grid gap-1 md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Delivery status:</span>{' '}
              <strong>{pod?.status?.replace(/_/g, ' ') ?? detail.deliveryStatus ?? '—'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Dispatch:</span> {detail.dispatchNo}
            </div>
            <div>
              <span className="text-muted-foreground">Sales Order:</span> {detail.salesOrderNo ?? '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Delivered qty:</span>{' '}
              {pod?.quantityDelivered ?? 0}
              {pod ? ` · damaged ${pod.quantityDamaged} · short ${pod.quantityShort}` : ''}
            </div>
            {pod?.deliveredAt ? (
              <div>
                <span className="text-muted-foreground">Delivered at:</span>{' '}
                {new Date(pod.deliveredAt).toLocaleString()}
              </div>
            ) : null}
            {pod?.receiverName ? (
              <div>
                <span className="text-muted-foreground">Receiver:</span> {pod.receiverName}
                {pod.receiverContact ? ` (${pod.receiverContact})` : ''}
              </div>
            ) : null}
          </div>

          {canPod ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="text-sm">
                Receiver name
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Receiver contact
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={receiverContact}
                  onChange={(e) => setReceiverContact(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Status
                <Select
                  className="mt-1"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DispatchPodStatus | '')}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="PARTIALLY_DELIVERED">Partially delivered</option>
                  <option value="DELIVERY_EXCEPTION">Delivery exception</option>
                  <option value="REJECTED_BY_CUSTOMER">Rejected by customer</option>
                  <option value="RETURN_INITIATED">Return initiated</option>
                </Select>
              </label>
              <label className="text-sm md:col-span-2">
                Delivery remarks
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1"
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-amber-700">Post the dispatch before capturing POD.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !canPod}
              className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold disabled:opacity-50"
              onClick={() => void onInTransit()}
            >
              Mark In Transit
            </button>
            <button
              type="button"
              disabled={busy || !canPod}
              className="h-8 rounded border border-erp-border bg-white px-2 text-[12px] font-semibold text-erp-primary disabled:opacity-50"
              onClick={() => void onCapture()}
            >
              Capture POD / Mark Delivered
            </button>
          </div>
        </>
      )}
    </section>
  )
}
