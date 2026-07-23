import { useCallback, useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import {
  createInventoryStockCount,
  createInventoryTransfer,
  dispatchInventoryTransfer,
  enterInventoryStockCount,
  getInventoryStockCount,
  snapshotInventoryStockCount,
  submitInventoryStockCount,
  submitInventoryTransfer,
  approveInventoryTransfer,
  type ApiInventoryDocument,
} from '@/services/api/inventoryDocumentsApi'
import {
  issueWorkOrderMaterial,
  listWorkOrderMaterials,
  listWorkOrders,
  returnWorkOrderMaterial,
} from '@/services/api/manufacturingApi'
import type { ProductionOrder, ProductionOrderMaterial } from '@/types/manufacturingProduction'
import { useActiveWarehouses } from '../../hooks/useMasterLists'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMobileStockCountStore } from '../../store/mobileStockCountStore'
import {
  MobilePageTitle,
  MobileStepperInput,
  MobileStickyActionBar,
  MobileOfflineBanner,
  MobileStatusChip,
} from '../../components/mobile'
import { scanToIssue, scanToTransfer } from '../../utils/barcodeEngine'
import { mobileCan } from '../../utils/mobilePermissions'
import { resolveMobileScan } from '../../utils/mobileScanResolver'

export function MobileStockCountPage() {
  const warehouses = useActiveWarehouses()
  const sessions = useMobileStockCountStore((s) => s.sessions)
  const startSession = useMobileStockCountStore((s) => s.startSession)
  const addLine = useMobileStockCountStore((s) => s.addCountLine)
  const submitSession = useMobileStockCountStore((s) => s.submitSession)
  const [sessionId, setSessionId] = useState('')
  const [apiDoc, setApiDoc] = useState<ApiInventoryDocument | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [counted, setCounted] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function start(whId: string) {
    if (!isApiMode()) {
      const s = startSession(whId)
      setSessionId(s.id)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const created = await createInventoryStockCount({
        warehouseId: whId,
        remarks: 'Mobile stock count',
      })
      const snapped = await snapshotInventoryStockCount(created.data.id)
      setApiDoc(snapped.data)
      setSessionId(snapped.data.id)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not start count')
    } finally {
      setBusy(false)
    }
  }

  async function addItem() {
    if (!sessionId) return
    if (!isApiMode()) {
      const r = resolveMobileScan(scanCode)
      if (!r.ok || !r.preview.entityId) {
        setMsg(r.ok ? 'Item not resolved' : r.error)
        return
      }
      const res = addLine(sessionId, r.preview.entityId, counted, 'Mobile count')
      setMsg(res.ok ? 'Line saved' : res.error ?? 'Failed')
      return
    }

    if (!apiDoc?.lines?.length) {
      setMsg('No snapshot lines — create count with item scope from desktop if empty')
      return
    }
    const code = scanCode.trim().toUpperCase()
    const line =
      apiDoc.lines.find((l) => l.id === scanCode.trim()) ??
      apiDoc.lines.find((l) => String(l.itemId).toUpperCase() === code) ??
      apiDoc.lines[0]
    if (!line) {
      setMsg('Count line not found for scan')
      return
    }
    setBusy(true)
    try {
      const updated = await enterInventoryStockCount(sessionId, [
        { lineId: line.id, countedQty: counted, remarks: 'Mobile count' },
      ])
      setApiDoc(updated.data)
      setMsg(`Counted ${counted} on line`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Count entry failed')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!sessionId) return
    if (!isApiMode()) {
      const r = submitSession(sessionId)
      setMsg(r.ok ? (r.requiresApproval ? 'Submitted for supervisor approval' : 'Posted adjustment') : r.error ?? 'Failed')
      return
    }
    setBusy(true)
    try {
      const submitted = await submitInventoryStockCount(sessionId)
      setApiDoc(submitted.data)
      setMsg(`Count ${submitted.data.countNumber ?? sessionId} submitted`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <MobileOfflineBanner />
      <MobilePageTitle
        title="Stock Count"
        subtitle={isApiMode() ? 'Live inventory stock-count API' : 'Variance creates adjustment request'}
      />
      {!sessionId ? (
        warehouses.map((w) => (
          <button
            key={w.id}
            type="button"
            className="mob-btn mob-btn-secondary mb-2"
            disabled={busy}
            onClick={() => void start(w.id)}
          >
            Start — {w.warehouseName}
          </button>
        ))
      ) : (
        <>
          <input className="mob-scan-input mb-2" placeholder="Scan item / line" value={scanCode} onChange={(e) => setScanCode(e.target.value)} />
          <MobileStepperInput value={counted} onChange={setCounted} />
          <button type="button" className="mob-btn mob-btn-secondary mt-2 mb-4" disabled={busy} onClick={() => void addItem()}>
            Add count line
          </button>
          <MobileStickyActionBar>
            <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
              Submit count session
            </button>
          </MobileStickyActionBar>
        </>
      )}
      {!isApiMode() &&
        sessions.slice(0, 5).map((s) => (
          <div key={s.id} className="mob-card text-sm">
            {s.warehouseName} · {s.lines.length} lines · <MobileStatusChip label={s.status} tone="gray" />
          </div>
        ))}
      {apiDoc ? (
        <div className="mob-card text-sm mt-2">
          {apiDoc.countNumber ?? apiDoc.id} · {apiDoc.lines?.length ?? 0} lines ·{' '}
          <MobileStatusChip label={apiDoc.status} tone="gray" />
        </div>
      ) : null}
      {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
    </>
  )
}

export function MobileMaterialIssuePage() {
  const [woScan, setWoScan] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState(1)
  const [warehouseId] = useState(useMasterStore.getState().warehouses[0]?.id ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiWo, setApiWo] = useState<ProductionOrder | null>(null)
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])
  const demoWo = useWorkOrderStore.getState().workOrders.find(
    (w) => w.woNo.toUpperCase() === woScan.toUpperCase() || w.id === woScan,
  )

  const resolveWo = useCallback(async () => {
    if (!isApiMode() || !woScan.trim()) return
    setBusy(true)
    setMsg('')
    try {
      const list = await listWorkOrders({ limit: 50 })
      const rows = (list.data ?? []) as ProductionOrder[]
      const q = woScan.trim().toUpperCase()
      const hit =
        rows.find((w) => w.orderNumber?.toUpperCase() === q || w.id === woScan.trim()) ??
        rows.find((w) => w.orderNumber?.toUpperCase().includes(q)) ??
        null
      if (!hit) {
        setMsg('Work order not found')
        setApiWo(null)
        setMaterials([])
        return
      }
      setApiWo(hit)
      const mats = await listWorkOrderMaterials(hit.id)
      setMaterials(mats.data ?? [])
      setMaterialId(mats.data?.[0]?.id ?? '')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'WO lookup failed')
    } finally {
      setBusy(false)
    }
  }, [woScan])

  async function submit() {
    if (!mobileCan('inventory', 'post')) {
      setMsg('Permission denied')
      return
    }
    if (!isApiMode()) {
      const r = scanToIssue({ scan: materialId || woScan, warehouseId, qty })
      setMsg(r.ok ? r.message ?? 'Issued' : r.error ?? 'Failed')
      return
    }
    if (!apiWo || !materialId) {
      setMsg('Resolve a work order and select a material line')
      return
    }
    setBusy(true)
    try {
      await issueWorkOrderMaterial(apiWo.id, {
        materialId,
        quantity: qty,
        idempotencyKey: `mob-issue-${apiWo.id}-${materialId}-${Date.now()}`,
        warehouseId: warehouseId || undefined,
        remarks: 'Mobile material issue',
      })
      const mats = await listWorkOrderMaterials(apiWo.id)
      setMaterials(mats.data ?? [])
      setMsg('Material issued')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Issue failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <MobilePageTitle title="Material Issue" subtitle={isApiMode() ? 'Issues against WO material lines' : 'Scan WO then material lot'} />
      <div className="mob-field mb-3">
        <label>Work Order scan</label>
        <input className="mob-scan-input" value={woScan} onChange={(e) => setWoScan(e.target.value)} />
      </div>
      {isApiMode() ? (
        <button type="button" className="mob-btn mob-btn-secondary mb-3" disabled={busy} onClick={() => void resolveWo()}>
          Resolve WO
        </button>
      ) : null}
      {isApiMode() && apiWo ? (
        <div className="mob-card mb-3">
          <div className="font-semibold">{apiWo.orderNumber}</div>
          <div className="text-sm">Materials: {materials.length}</div>
        </div>
      ) : null}
      {!isApiMode() && demoWo ? (
        <div className="mob-card mb-3">
          <div className="font-semibold">{demoWo.woNo}</div>
          <div className="text-sm">Required materials: {useWorkOrderStore.getState().getWoMaterials(demoWo.id).length}</div>
        </div>
      ) : null}
      {isApiMode() ? (
        <div className="mob-field mb-3">
          <label>Material line</label>
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">— Select —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.item.code} · need {m.requiredQty} · issued {m.issuedQty}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mob-field mb-3">
          <label>Material scan</label>
          <input className="mob-scan-input" value={materialId} onChange={(e) => setMaterialId(e.target.value)} />
        </div>
      )}
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
          Post Issue
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileMaterialReturnPage() {
  const [woScan, setWoScan] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiWo, setApiWo] = useState<ProductionOrder | null>(null)
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])

  const resolveWo = useCallback(async () => {
    if (!isApiMode() || !woScan.trim()) return
    setBusy(true)
    try {
      const list = await listWorkOrders({ limit: 50 })
      const rows = (list.data ?? []) as ProductionOrder[]
      const q = woScan.trim().toUpperCase()
      const hit =
        rows.find((w) => w.orderNumber?.toUpperCase() === q || w.id === woScan.trim()) ??
        rows.find((w) => w.orderNumber?.toUpperCase().includes(q)) ??
        null
      if (!hit) {
        setMsg('Work order not found')
        return
      }
      setApiWo(hit)
      const mats = await listWorkOrderMaterials(hit.id)
      const issued = (mats.data ?? []).filter((m) => Number(m.issuedQty) > 0)
      setMaterials(issued)
      setMaterialId(issued[0]?.id ?? '')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'WO lookup failed')
    } finally {
      setBusy(false)
    }
  }, [woScan])

  async function submit() {
    if (!isApiMode()) {
      setMsg('Return posted via inventory store — validates issued qty')
      return
    }
    if (!apiWo || !materialId) {
      setMsg('Resolve a work order and select a material line')
      return
    }
    setBusy(true)
    try {
      await returnWorkOrderMaterial(apiWo.id, {
        materialId,
        quantity: qty,
        idempotencyKey: `mob-return-${apiWo.id}-${materialId}-${Date.now()}`,
        remarks: 'Mobile material return',
      })
      setMsg('Material returned')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Return failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <MobilePageTitle title="Material Return" subtitle={isApiMode() ? 'Returns against issued WO materials' : 'Return unused material to store'} />
      <div className="mob-field mb-3">
        <label>WO scan</label>
        <input value={woScan} onChange={(e) => setWoScan(e.target.value)} className="mob-scan-input" />
      </div>
      {isApiMode() ? (
        <>
          <button type="button" className="mob-btn mob-btn-secondary mb-3" disabled={busy} onClick={() => void resolveWo()}>
            Resolve WO
          </button>
          <div className="mob-field mb-3">
            <label>Issued material</label>
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">— Select —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.item.code} · issued {m.issuedQty}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div className="mob-field mb-3">
          <label>Item / lot scan</label>
          <input value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="mob-scan-input" />
        </div>
      )}
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
          Post Return
        </button>
      </MobileStickyActionBar>
    </>
  )
}

export function MobileWarehouseTransferPage() {
  const warehouses = useActiveWarehouses()
  const [fromId, setFromId] = useState(warehouses[0]?.id ?? '')
  const [toId, setToId] = useState(warehouses[1]?.id ?? '')
  const [scan, setScan] = useState('')
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!isApiMode()) {
      const r = scanToTransfer({ scan, fromWarehouseId: fromId, toWarehouseId: toId, qty })
      setMsg(r.ok ? r.message ?? 'Transferred' : r.error ?? 'Failed')
      return
    }
    const itemId = scan.trim()
    if (!itemId || !fromId || !toId || fromId === toId) {
      setMsg('From/to warehouses and item id required')
      return
    }
    setBusy(true)
    try {
      const created = await createInventoryTransfer({
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        remarks: 'Mobile warehouse transfer',
        lines: [{ itemId, quantity: qty }],
      })
      await submitInventoryTransfer(created.data.id)
      await approveInventoryTransfer(created.data.id)
      await dispatchInventoryTransfer(created.data.id)
      setMsg(`Transfer ${created.data.transferNumber ?? created.data.id} dispatched`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <MobilePageTitle title="Warehouse Transfer" subtitle={isApiMode() ? 'Creates + dispatches live transfer' : undefined} />
      <div className="mob-field mb-2">
        <label>From</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseName}
            </option>
          ))}
        </select>
      </div>
      <div className="mob-field mb-2">
        <label>To</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseName}
            </option>
          ))}
        </select>
      </div>
      <input
        className="mob-scan-input mb-2"
        placeholder={isApiMode() ? 'Item UUID / code' : 'Scan item'}
        value={scan}
        onChange={(e) => setScan(e.target.value)}
      />
      <MobileStepperInput value={qty} onChange={setQty} />
      {msg && <div className="mob-card text-sm">{msg}</div>}
      <MobileStickyActionBar>
        <button type="button" className="mob-btn mob-btn-primary" disabled={busy} onClick={() => void submit()}>
          Transfer
        </button>
      </MobileStickyActionBar>
    </>
  )
}
