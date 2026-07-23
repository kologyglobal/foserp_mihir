import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import {
  createGRNFromPo,
  getPurchaseOrders,
  postGRN,
  submitGRN,
} from '@/services/purchase/purchaseApiFacade'
import type { PurchaseOrder } from '@/types/purchaseDomain'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import {
  MobilePageTitle,
  MobileStatusChip,
  MobileStepperInput,
  MobileStickyActionBar,
  MobileOfflineBanner,
} from '../../components/mobile'
import { mobileGrnCanReceive } from '../../utils/mobilePermissions'
import { resolveMobileScan } from '../../utils/mobileScanResolver'

function isOpenPo(po: PurchaseOrder): boolean {
  if (['closed', 'cancelled'].includes(po.status)) return false
  return po.lines.some((l) => l.receivedQty < l.quantity)
}

export function MobileGrnListPage() {
  const navigate = useNavigate()
  const demoPos = usePurchaseStore((s) =>
    s.purchaseOrders.filter(
      (p) => !['closed', 'cancelled'].includes(p.status) && p.lines.some((l) => l.receivedQty < l.qty),
    ),
  )
  const [apiPos, setApiPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setLoading(true)
    setError('')
    try {
      const orders = await getPurchaseOrders()
      setApiPos(orders.filter(isOpenPo))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pos = isApiMode() ? apiPos : demoPos

  return (
    <>
      <MobilePageTitle
        title="GRN Receiving"
        subtitle={isApiMode() ? (loading ? 'Loading open POs…' : `${pos.length} open POs`) : 'Scan PO or select open order'}
      />
      {error ? <div className="mob-card text-sm text-[#c42b2f] mb-3">{error}</div> : null}
      <button
        type="button"
        className="mob-btn mob-btn-secondary mb-4"
        onClick={() => {
          const code = window.prompt('Scan / enter PO number:')
          if (!code) return
          if (isApiMode()) {
            const hit = apiPos.find(
              (p) =>
                p.documentNumber.toUpperCase() === code.trim().toUpperCase() ||
                p.id === code.trim(),
            )
            if (hit) navigate(`/m/grn/${hit.id}`)
            else setError(`PO not found: ${code}`)
            return
          }
          const r = resolveMobileScan(code)
          if (r.ok && r.preview.entityId) navigate(`/m/grn/${r.preview.entityId}`)
        }}
      >
        Scan PO
      </button>
      {pos.map((po) => (
        <button
          key={po.id}
          type="button"
          className="mob-card w-full text-left mb-2"
          onClick={() => navigate(`/m/grn/${po.id}`)}
        >
          <div className="font-semibold">{isApiMode() ? (po as PurchaseOrder).documentNumber : (po as { poNo?: string }).poNo}</div>
          <div className="text-sm text-[#605e5c]">
            {isApiMode()
              ? (po as PurchaseOrder).vendor.name
              : useMasterStore.getState().getVendor((po as { vendorId: string }).vendorId)?.vendorName}
          </div>
          <MobileStatusChip label={po.status} tone="amber" />
        </button>
      ))}
    </>
  )
}

export function MobileGrnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const demoPo = usePurchaseStore((s) => s.getPo(id ?? ''))
  const demoGrn = usePurchaseStore((s) => s.grns.find((g) => g.poId === id))
  const [apiPo, setApiPo] = useState<PurchaseOrder | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getPurchaseOrders()
      .then((orders) => {
        const hit = orders.find((o) => o.id === id)
        if (!hit) setError('PO not found')
        else setApiPo(hit)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load PO'))
  }, [id])

  if (isApiMode()) {
    if (error) return <MobilePageTitle title="GRN" subtitle={error} />
    if (!apiPo) return <MobilePageTitle title="GRN" subtitle="Loading…" />
    return (
      <>
        <MobilePageTitle title={apiPo.documentNumber} subtitle="Select line to receive" />
        {apiPo.lines.map((line) => {
          const open = line.quantity - line.receivedQty
          return (
            <button
              key={line.id}
              type="button"
              className="mob-card w-full text-left mb-2"
              disabled={open <= 0}
              onClick={() => navigate(`/m/grn/${apiPo.id}/receive?lineId=${line.id}`)}
            >
              <div className="font-semibold">{line.itemCode}</div>
              <div className="text-sm">{line.itemName}</div>
              <div className="text-sm mt-1">
                Open: {open} / {line.quantity}
              </div>
            </button>
          )
        })}
      </>
    )
  }

  if (!demoPo) {
    return <MobilePageTitle title="GRN" subtitle="PO not found" />
  }

  return (
    <>
      <MobilePageTitle title={demoPo.poNo} subtitle="Select line to receive" />
      {demoPo.lines.map((line) => {
        const item = useMasterStore.getState().getItem(line.itemId)
        const open = line.qty - line.receivedQty
        return (
          <button
            key={line.id}
            type="button"
            className="mob-card w-full text-left mb-2"
            disabled={open <= 0}
            onClick={() => navigate(`/m/grn/${demoPo.id}/receive?lineId=${line.id}`)}
          >
            <div className="font-semibold">{item?.itemCode ?? line.itemId}</div>
            <div className="text-sm">{item?.itemName}</div>
            <div className="text-sm mt-1">
              Open: {open} / {line.qty}
            </div>
          </button>
        )
      })}
      {demoGrn && (
        <div className="mob-card mt-4">
          Latest GRN: {demoGrn.grnNo} · <MobileStatusChip label={demoGrn.status} tone="green" />
        </div>
      )}
    </>
  )
}

export function MobileGrnReceivePage() {
  const { id } = useParams<{ id: string }>()
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const lineId = params.get('lineId') ?? ''
  const navigate = useNavigate()
  const demoPo = usePurchaseStore((s) => s.getPo(id ?? ''))
  const postDemoGrn = usePurchaseStore((s) => s.postGrn)
  const [apiPo, setApiPo] = useState<PurchaseOrder | null>(null)
  const [qty, setQty] = useState(0)
  const [batch, setBatch] = useState('')
  const [damaged, setDamaged] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const canReceive = mobileGrnCanReceive()

  useEffect(() => {
    if (!isApiMode() || !id) return
    void getPurchaseOrders().then((orders) => {
      const hit = orders.find((o) => o.id === id) ?? null
      setApiPo(hit)
      const line = hit?.lines.find((l) => l.id === lineId)
      if (line) setQty(Math.max(0, line.quantity - line.receivedQty))
    })
  }, [id, lineId])

  useEffect(() => {
    if (isApiMode() || !demoPo) return
    const line = demoPo.lines.find((l) => l.id === lineId)
    if (line) setQty(Math.max(0, line.qty - line.receivedQty))
  }, [demoPo, lineId])

  if (isApiMode()) {
    const line = apiPo?.lines.find((l) => l.id === lineId)
    if (!apiPo || !line) {
      return <MobilePageTitle title="Receive" subtitle={apiPo ? 'Line not found' : 'Loading…'} />
    }
    const open = line.quantity - line.receivedQty

    async function submitApi() {
      if (!canReceive) {
        setMsg('Permission denied')
        return
      }
      if (qty <= 0 || qty > open * 1.05) {
        setMsg(`Qty must be 1–${open} (within PO tolerance)`)
        return
      }
      setBusy(true)
      setMsg('')
      try {
        const grn = await createGRNFromPo({
          purchaseOrderId: apiPo!.id,
          warehouseId: apiPo!.deliveryLocation?.id ?? apiPo!.location?.id,
          warehouseName: apiPo!.deliveryLocation?.name ?? apiPo!.location?.name,
          remarks: damaged ? 'Mobile receive — QC hold flagged' : 'Mobile receive',
          lines: [
            {
              purchaseOrderLineId: line!.id,
              receivedQty: qty,
              acceptedQty: damaged ? 0 : qty,
              damagedQty: damaged ? qty : 0,
              batchNumber: batch || undefined,
            },
          ],
        })
        await submitGRN(grn.id)
        await postGRN(grn.id)
        setMsg(`GRN ${grn.documentNumber} posted`)
        setTimeout(() => navigate(`/m/grn/${apiPo!.id}`), 800)
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'GRN failed')
      } finally {
        setBusy(false)
      }
    }

    return (
      <>
        <MobileOfflineBanner />
        <MobilePageTitle title="Receive Line" subtitle={line.itemCode} />
        <div className="mob-card">
          <div className="font-semibold">{line.itemName}</div>
          <div className="text-sm">Open qty: {open}</div>
        </div>
        <div className="mob-field mb-3">
          <label>Received qty</label>
          <MobileStepperInput value={qty} onChange={setQty} min={0} max={Math.ceil(open * 1.05)} />
        </div>
        <div className="mob-field mb-3">
          <label>Batch / lot</label>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 mb-3 text-sm">
          <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} />
          Flag as damaged / QC hold
        </label>
        {msg && <div className="mob-card text-sm">{msg}</div>}
        <MobileStickyActionBar>
          <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submitApi()}>
            {busy ? 'Posting…' : 'Post GRN'}
          </button>
        </MobileStickyActionBar>
      </>
    )
  }

  const line = demoPo?.lines.find((l) => l.id === lineId)
  const item = line ? useMasterStore.getState().getItem(line.itemId) : undefined
  const open = line ? line.qty - line.receivedQty : 0

  if (!demoPo || !line || !item) {
    return <MobilePageTitle title="Receive" subtitle="Line not found" />
  }

  function submit() {
    if (!canReceive) {
      setMsg('Permission denied')
      return
    }
    if (!item!.isActive) {
      setMsg('Cannot receive inactive item')
      return
    }
    if (qty <= 0 || qty > open + open * 0.05) {
      setMsg(`Qty must be 1–${open} (within PO tolerance)`)
      return
    }
    const r = postDemoGrn(demoPo!.id, [{ poLineId: line!.id, receivedQty: qty }])
    if (!r.ok) {
      setMsg(r.error ?? 'GRN failed')
      return
    }
    setMsg(`GRN posted — ${damaged ? 'QC hold flagged' : 'inventory updated'}`)
    setTimeout(() => navigate(`/m/grn/${demoPo!.id}`), 800)
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle title="Receive Line" subtitle={item.itemCode} />
      <div className="mob-card">
        <div className="font-semibold">{item.itemName}</div>
        <div className="text-sm">Open qty: {open}</div>
      </div>
      <div className="mob-field mb-3">
        <label>Received qty</label>
        <MobileStepperInput value={qty} onChange={setQty} min={0} max={Math.ceil(open * 1.05)} />
      </div>
      <div className="mob-field mb-3">
        <label>Batch / lot</label>
        <input value={batch} onChange={(e) => setBatch(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 mb-3 text-sm">
        <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} />
        Flag as damaged / QC hold
      </label>
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" onClick={submit}>
          Post GRN
        </button>
      </MobileStickyActionBar>
    </>
  )
}
