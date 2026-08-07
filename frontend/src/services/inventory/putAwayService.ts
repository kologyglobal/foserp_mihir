/**
 * Put-away: after GRN inventory is on the ledger, move into storage using the
 * existing transfer / scan engines. No separate put-away stock table.
 */
import { getGRNs } from '../purchase'
import type { GoodsReceiptNote } from '../../types/purchaseDomain'

export type PutAwayQueueKind = 'awaiting_stock_post' | 'ready_for_putaway'

export type PutAwayLine = {
  lineId: string
  itemId: string
  itemCode: string
  itemName: string
  qty: number
  bin: string
  batchNumber: string
  serialNumber: string
}

export type PutAwayCard = {
  grnId: string
  grnNumber: string
  status: string
  vendorName: string
  warehouseId: string
  warehouseName: string
  receivingLocation: string
  documentDate: string
  kind: PutAwayQueueKind
  lines: PutAwayLine[]
  /** Deep link to complete post-inventory on GRN */
  openGrnHref: string
  /** Prefill transfer create (warehouse → storage) via inventory transfer engine */
  putAwayTransferHref: string
  scanHref: string
}

function isTerminalCancelled(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'cancelled' || s === 'rejected'
}

function isPosted(status: string): boolean {
  return status.toLowerCase() === 'posted'
}

function needsStockPost(status: string): boolean {
  const s = status.toLowerCase()
  return (
    s === 'accepted' ||
    s === 'partially_accepted' ||
    s === 'pending_inspection' ||
    s === 'pending_tolerance_approval' ||
    s === 'draft'
  )
}

export async function listPutAwayQueue(): Promise<{
  awaitingStockPost: PutAwayCard[]
  readyForPutAway: PutAwayCard[]
}> {
  const grns = await getGRNs()
  const awaitingStockPost: PutAwayCard[] = []
  const readyForPutAway: PutAwayCard[] = []

  for (const grn of grns) {
    if (isTerminalCancelled(grn.status)) continue
    const card = toCard(grn)
    if (!card) continue
    if (isPosted(grn.status)) readyForPutAway.push(card)
    else if (needsStockPost(grn.status)) awaitingStockPost.push(card)
  }

  awaitingStockPost.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
  readyForPutAway.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
  return { awaitingStockPost, readyForPutAway }
}

function toCard(grn: GoodsReceiptNote): PutAwayCard | null {
  const lines: PutAwayLine[] = (grn.lines ?? [])
    .filter((l) => Number(l.receivedQty ?? l.acceptedQty ?? 0) > 0)
    .map((l) => ({
      lineId: l.id,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      qty: Number(l.receivedQty ?? l.acceptedQty ?? 0),
      bin: (l.bin || l.binId || '').trim(),
      batchNumber: (l.batchNumber || l.lotNumber || '').trim(),
      serialNumber: (l.serialNumber || '').trim(),
    }))

  if (lines.length === 0 && !isPosted(grn.status)) {
    // still show draft/accepted GRNs so store can finish receive
  }

  const firstItem = lines[0]
  const q = new URLSearchParams()
  if (grn.warehouseId) {
    q.set('fromWarehouseId', grn.warehouseId)
    q.set('toWarehouseId', grn.warehouseId)
  }
  if (firstItem?.itemId) {
    q.set('itemId', firstItem.itemId)
    q.set('quantity', String(firstItem.qty))
  }
  q.set('remarks', `Put-away after ${grn.documentNumber}`)
  q.set('grnId', grn.id)
  q.set('create', '1')

  return {
    grnId: grn.id,
    grnNumber: grn.documentNumber,
    status: grn.status,
    vendorName: grn.vendor?.name || '-',
    warehouseId: grn.warehouseId,
    warehouseName: grn.warehouseName || '-',
    receivingLocation: grn.receivingLocation || 'Receiving',
    documentDate: grn.documentDate,
    kind: isPosted(grn.status) ? 'ready_for_putaway' : 'awaiting_stock_post',
    lines,
    openGrnHref: `/purchase/grn/${grn.id}`,
    putAwayTransferHref: `/inventory/movements/transfers/new?${q.toString()}`,
    scanHref: `/inventory/scan/transfer?fromWarehouseId=${encodeURIComponent(grn.warehouseId || '')}&grnId=${encodeURIComponent(grn.id)}&create=1`,
  }
}
