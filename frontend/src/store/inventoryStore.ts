import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  StockMovement,
  StockMovementType,
  StockPositionEnriched,
  StockReferenceType,
  StockReservation,
  ReservationDemandType,
} from '../types/inventory'
import { seedReservations, seedStockMovements } from '../data/inventory/seed'
import {
  computeBalanceAfter,
  computeFreeQty,
  computeOnHand,
  computeReservedQty,
  enrichStockPosition,
  hasOpeningMovement,
  nextMovementNo,
} from '../utils/inventory'
import { useMasterStore } from './masterStore'
import { erpStorage } from './persistConfig'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

interface TxnInput {
  itemId: string
  warehouseId: string
  qty: number
  rate?: number
  referenceNo: string
  remarks: string
  txnDate?: string
}

interface InventoryState {
  /** Single source of truth for on-hand stock */
  stockMovements: StockMovement[]
  reservations: StockReservation[]

  getOnHand: (itemId: string, warehouseId: string) => number
  getReservedQty: (itemId: string, warehouseId: string) => number
  getFreeQty: (itemId: string, warehouseId: string) => number
  getStockPositions: (warehouseId?: string, itemSearch?: string) => StockPositionEnriched[]
  getLowStockItems: () => StockPositionEnriched[]
  getMovements: (filters?: {
    itemId?: string
    warehouseId?: string
    movementType?: StockMovementType
  }) => StockMovement[]
  getItemMovements: (itemId: string, warehouseId?: string) => StockMovement[]

  getReservations: (filters?: {
    status?: StockReservation['status']
    demandType?: ReservationDemandType
    itemId?: string
  }) => StockReservation[]
  createReservation: (input: {
    itemId: string
    warehouseId: string
    qty: number
    demandType: ReservationDemandType
    demandId: string
    remarks?: string
  }) => { ok: boolean; error?: string; id?: string }
  updateReservation: (
    id: string,
    data: Partial<Pick<StockReservation, 'qty' | 'remarks' | 'demandId'>>,
  ) => { ok: boolean; error?: string }
  cancelReservation: (id: string) => { ok: boolean; error?: string }
  fulfillReservation: (id: string) => { ok: boolean; error?: string }

  getSoReservedQty: (salesOrderNo: string, itemId: string, warehouseId: string) => number
  reserveForSalesOrder: (
    salesOrderNo: string,
    lines: { itemId: string; warehouseId: string; requiredQty: number }[],
  ) => { ok: boolean; reservedLines: number; reservedQty: number; partialLines: number; error?: string }

  postOpeningStock: (input: TxnInput) => { ok: boolean; error?: string; movementNo?: string }
  postInward: (input: TxnInput & { referenceType?: StockReferenceType }) => { ok: boolean; error?: string; movementNo?: string }
  postGrnReceipt: (input: TxnInput) => { ok: boolean; error?: string; movementNo?: string }
  postStockTransfer: (input: TxnInput & { fromWarehouseId: string }) => { ok: boolean; error?: string; movementNo?: string }
  postIssue: (input: TxnInput) => { ok: boolean; error?: string; movementNo?: string }
  postIssueToWorkOrder: (input: TxnInput & { workOrderId: string; maxFromReserved?: number }) => { ok: boolean; error?: string; movementNo?: string }
  postWipReceive: (input: TxnInput & { workOrderId: string; referenceType?: StockReferenceType }) => { ok: boolean; error?: string; movementNo?: string }
  postWipTransfer: (input: TxnInput & { fromWarehouseId: string; workOrderId: string; referenceType?: StockReferenceType }) => { ok: boolean; error?: string; movementNo?: string }
  postFgReceipt: (input: TxnInput & { workOrderId: string }) => { ok: boolean; error?: string; movementNo?: string }
  postDispatchIssue: (input: TxnInput & { dispatchId: string; salesOrderNo: string }) => { ok: boolean; error?: string; movementNo?: string }
  postSaReceipt: (input: TxnInput & { workOrderId: string; sourceWoId: string; parentWoId?: string | null }) => { ok: boolean; error?: string; movementNo?: string }
  postSubcontractOut: (input: TxnInput & { workOrderId: string }) => { ok: boolean; error?: string; movementNo?: string }
  postSubcontractIn: (input: TxnInput & { workOrderId: string }) => { ok: boolean; error?: string; movementNo?: string }
  postAdjustment: (input: TxnInput & { isPositive: boolean }) => { ok: boolean; error?: string; movementNo?: string }

  getWoReservedQty: (woNo: string, itemId: string, warehouseId: string) => number
}

function getMasterCtx() {
  const s = useMasterStore.getState()
  return {
    getItem: s.getItem,
    getWarehouse: s.getWarehouse,
    getProductByFgItem: s.getProductByFgItem,
    getCategoryName: s.getCategoryName,
    getUomCode: (id: string) => s.uoms.find((u) => u.id === id)?.uomCode ?? '—',
    items: s.items,
    warehouses: s.warehouses,
  }
}

function validateItemWarehouse(itemId: string, warehouseId: string) {
  const { getItem, getWarehouse, getProductByFgItem } = getMasterCtx()
  const item = getItem(itemId)
  if (!item) return { ok: false as const, error: 'Item must exist in Item Master' }
  if (!item.isActive) return { ok: false as const, error: 'Item is inactive' }
  if (!item.isStockable) return { ok: false as const, error: 'Item is not stockable' }
  if (item.itemType === 'finished_good' && !getProductByFgItem(itemId)) {
    return {
      ok: false as const,
      error: 'FG stock requires a linked Product — create Product with this FG Item first',
    }
  }
  const wh = getWarehouse(warehouseId)
  if (!wh) return { ok: false as const, error: 'Warehouse must exist in Warehouse Master' }
  if (!wh.isActive) return { ok: false as const, error: 'Warehouse is inactive' }
  return { ok: true as const, item, warehouse: wh }
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
  stockMovements: [...seedStockMovements],
  reservations: seedReservations.map((r) => ({ ...r })),

  getOnHand: (itemId, warehouseId) =>
    computeOnHand(get().stockMovements, itemId, warehouseId),

  getReservedQty: (itemId, warehouseId) =>
    computeReservedQty(get().reservations, itemId, warehouseId),

  getFreeQty: (itemId, warehouseId) =>
    computeFreeQty(get().getOnHand(itemId, warehouseId), get().getReservedQty(itemId, warehouseId)),

  getStockPositions: (warehouseId?, itemSearch?) => {
    const { items, warehouses, getCategoryName, getUomCode } = getMasterCtx()
    const search = itemSearch?.toLowerCase() ?? ''
    const movements = get().stockMovements
    const reservations = get().reservations
    const positions: StockPositionEnriched[] = []

    const whList = warehouseId
      ? warehouses.filter((w) => w.id === warehouseId)
      : warehouses.filter((w) => w.isActive)

    for (const wh of whList) {
      for (const item of items.filter((i) => i.isStockable && i.isActive)) {
        if (item.itemType === 'finished_good' && !useMasterStore.getState().isFgItemLinkedToProduct(item.id)) {
          continue
        }
        if (search && !item.itemCode.toLowerCase().includes(search) && !item.itemName.toLowerCase().includes(search)) {
          continue
        }
        const onHand = computeOnHand(movements, item.id, wh.id)
        const reservedQty = computeReservedQty(reservations, item.id, wh.id)
        const hasActivity = onHand !== 0 || reservedQty > 0 ||
          movements.some((m) => m.itemId === item.id && m.warehouseId === wh.id)
        if (!hasActivity && !warehouseId) continue

        positions.push(
          enrichStockPosition(item, wh, getCategoryName(item.categoryId), getUomCode(item.baseUomId), movements, reservations),
        )
      }
    }
    return positions.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
  },

  getLowStockItems: () =>
    get()
      .getStockPositions()
      .filter((p) => p.isLowStock)
      .sort((a, b) => a.onHand - a.reorderLevel - (b.onHand - b.reorderLevel)),

  getMovements: (filters) => {
    let entries = [...get().stockMovements].sort(
      (a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime(),
    )
    if (filters?.itemId) entries = entries.filter((e) => e.itemId === filters.itemId)
    if (filters?.warehouseId) entries = entries.filter((e) => e.warehouseId === filters.warehouseId)
    if (filters?.movementType) entries = entries.filter((e) => e.movementType === filters.movementType)
    return entries
  },

  getItemMovements: (itemId, warehouseId) =>
    get().getMovements({ itemId, warehouseId }),

  getReservations: (filters) => {
    let list = [...get().reservations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    if (filters?.status) list = list.filter((r) => r.status === filters.status)
    if (filters?.demandType) list = list.filter((r) => r.demandType === filters.demandType)
    if (filters?.itemId) list = list.filter((r) => r.itemId === filters.itemId)
    return list
  },

  createReservation: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Reservation quantity must be positive' }
    if (!input.demandId.trim()) return { ok: false, error: 'Demand reference (SO/WO number) required' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const free = get().getFreeQty(input.itemId, input.warehouseId)
    if (input.qty > free) {
      return { ok: false, error: `Insufficient free stock. Free: ${free}` }
    }
    const ts = new Date().toISOString()
    const reservation: StockReservation = {
      id: genId('res'),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      qty: input.qty,
      demandType: input.demandType,
      demandId: input.demandId.trim(),
      referenceNo: input.demandId.trim(),
      remarks: input.remarks ?? '',
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    }
    set((s) => ({ reservations: [reservation, ...s.reservations] }))
    return { ok: true, id: reservation.id }
  },

  updateReservation: (id, data) => {
    const existing = get().reservations.find((r) => r.id === id)
    if (!existing) return { ok: false, error: 'Reservation not found' }
    if (existing.status !== 'active') return { ok: false, error: 'Only active reservations can be edited' }
    if (data.qty !== undefined) {
      if (data.qty <= 0) return { ok: false, error: 'Quantity must be positive' }
      const otherReserved = get().reservations
        .filter((r) => r.status === 'active' && r.id !== id && r.itemId === existing.itemId && r.warehouseId === existing.warehouseId)
        .reduce((s, r) => s + r.qty, 0)
      const onHand = get().getOnHand(existing.itemId, existing.warehouseId)
      const available = onHand - otherReserved
      if (data.qty > available) {
        return { ok: false, error: `Cannot reserve ${data.qty} — only ${available} available` }
      }
    }
    set((s) => ({
      reservations: s.reservations.map((r) =>
        r.id === id
          ? {
              ...r,
              ...data,
              referenceNo: data.demandId?.trim() ?? r.referenceNo,
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    }))
    return { ok: true }
  },

  cancelReservation: (id) => {
    const existing = get().reservations.find((r) => r.id === id)
    if (!existing) return { ok: false, error: 'Reservation not found' }
    if (existing.status !== 'active') return { ok: false, error: 'Reservation is not active' }
    set((s) => ({
      reservations: s.reservations.map((r) =>
        r.id === id ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : r,
      ),
    }))
    return { ok: true }
  },

  fulfillReservation: (id) => {
    const existing = get().reservations.find((r) => r.id === id)
    if (!existing) return { ok: false, error: 'Reservation not found' }
    if (existing.status !== 'active') return { ok: false, error: 'Reservation is not active' }
    set((s) => ({
      reservations: s.reservations.map((r) =>
        r.id === id ? { ...r, status: 'fulfilled' as const, updatedAt: new Date().toISOString() } : r,
      ),
    }))
    return { ok: true }
  },

  getSoReservedQty: (salesOrderNo, itemId, warehouseId) =>
    get().reservations
      .filter(
        (r) =>
          r.status === 'active' &&
          r.demandType === 'SO' &&
          r.demandId === salesOrderNo &&
          r.itemId === itemId &&
          r.warehouseId === warehouseId,
      )
      .reduce((sum, r) => sum + r.qty, 0),

  reserveForSalesOrder: (salesOrderNo, lines) => {
    let reservedLines = 0
    let reservedQty = 0
    let partialLines = 0

    for (const line of lines) {
      const already = get().getSoReservedQty(salesOrderNo, line.itemId, line.warehouseId)
      const gap = line.requiredQty - already
      if (gap <= 0) continue

      const free = get().getFreeQty(line.itemId, line.warehouseId)
      const qty = Math.min(gap, free)
      if (qty <= 0) continue

      const result = get().createReservation({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty,
        demandType: 'SO',
        demandId: salesOrderNo,
        remarks: `SO material reservation — ${salesOrderNo}`,
      })
      if (!result.ok) continue

      reservedLines += 1
      reservedQty += qty
      if (qty < gap) partialLines += 1
    }

    return {
      ok: reservedLines > 0 || lines.every((l) => {
        const already = get().getSoReservedQty(salesOrderNo, l.itemId, l.warehouseId)
        return already >= l.requiredQty
      }),
      reservedLines,
      reservedQty,
      partialLines,
      error: reservedLines === 0 ? 'No free stock available to reserve' : undefined,
    }
  },

  postOpeningStock: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Opening quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    if (hasOpeningMovement(get().stockMovements, input.itemId, input.warehouseId)) {
      return { ok: false, error: 'Opening stock already posted for this item/warehouse — use adjustment' }
    }
    return applyMovement(get, set, 'opening', input, 'OPN', 1, null)
  },

  postInward: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Inward quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const refType = (input as TxnInput & { referenceType?: StockReferenceType }).referenceType ?? 'INW'
    return applyMovement(get, set, 'inward', input, refType, 1, null)
  },

  postGrnReceipt: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'GRN quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    return applyMovement(get, set, 'inward', input, 'GRN', 1, null)
  },

  postStockTransfer: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Transfer quantity must be positive' }
    const vFrom = validateItemWarehouse(input.itemId, input.fromWarehouseId)
    if (!vFrom.ok) return vFrom
    const vTo = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!vTo.ok) return vTo
    const onHand = get().getOnHand(input.itemId, input.fromWarehouseId)
    if (input.qty > onHand) {
      return { ok: false, error: `Insufficient stock at source. On hand: ${onHand}` }
    }
    const issueResult = applyMovement(
      get,
      set,
      'issue',
      { ...input, warehouseId: input.fromWarehouseId, remarks: `${input.remarks} (transfer out)` },
      'ADJ',
      -1,
      null,
    )
    if (!issueResult.ok) return issueResult
    return applyMovement(get, set, 'inward', input, 'ADJ', 1, null)
  },

  postIssue: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Issue quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const free = get().getFreeQty(input.itemId, input.warehouseId)
    if (input.qty > free) {
      return { ok: false, error: `Insufficient free stock. Free: ${free} ${v.item.itemCode}` }
    }
    return applyMovement(get, set, 'issue', input, 'ISS', -1, null)
  },

  postIssueToWorkOrder: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Issue quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const woReserved = get().getWoReservedQty(input.referenceNo, input.itemId, input.warehouseId)
    const pendingReserved = input.maxFromReserved ?? woReserved
    if (input.qty > pendingReserved) {
      return { ok: false, error: `Cannot issue ${input.qty} — only ${pendingReserved} reserved for this WO line` }
    }
    const onHand = get().getOnHand(input.itemId, input.warehouseId)
    if (input.qty > onHand) {
      return { ok: false, error: `Insufficient on-hand stock. On hand: ${onHand}` }
    }
    return applyMovement(get, set, 'issue', input, 'ISSUE_TO_WO', -1, input.workOrderId)
  },

  postWipReceive: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Receive quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const refType = input.referenceType ?? 'WIP_RECEIVE'
    return applyMovement(get, set, 'inward', input, refType, 1, input.workOrderId)
  },

  postWipTransfer: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Transfer quantity must be positive' }
    const vFrom = validateItemWarehouse(input.itemId, input.fromWarehouseId)
    if (!vFrom.ok) return vFrom
    const vTo = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!vTo.ok) return vTo
    const onHand = get().getOnHand(input.itemId, input.fromWarehouseId)
    if (input.qty > onHand) {
      return { ok: false, error: `Insufficient WIP at ${vFrom.warehouse.warehouseCode}. On hand: ${onHand}` }
    }
    const refType = input.referenceType ?? 'WIP_TRANSFER'
    const issueResult = applyMovement(
      get,
      set,
      'issue',
      {
        ...input,
        warehouseId: input.fromWarehouseId,
        remarks: `${input.remarks} (from ${vFrom.warehouse.warehouseCode})`,
      },
      refType,
      -1,
      input.workOrderId,
    )
    if (!issueResult.ok) return issueResult
    return applyMovement(get, set, 'inward', input, refType, 1, input.workOrderId)
  },

  postFgReceipt: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Receipt quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    return applyMovement(get, set, 'inward', input, 'FG_RECEIPT', 1, input.workOrderId)
  },

  postDispatchIssue: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Dispatch quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const free = get().getFreeQty(input.itemId, input.warehouseId)
    if (input.qty > free) {
      return { ok: false, error: `Insufficient FG stock. Free: ${free} ${v.item.itemCode}` }
    }
    return applyMovement(get, set, 'issue', input, 'FG_DISPATCH', -1, null)
  },

  postSaReceipt: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Receipt quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    return applyMovement(get, set, 'inward', input, 'SA_RECEIPT', 1, input.workOrderId, {
      sourceWoId: input.sourceWoId,
      parentWoId: input.parentWoId ?? null,
    })
  },

  postSubcontractOut: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Send quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    const free = get().getFreeQty(input.itemId, input.warehouseId)
    if (input.qty > free) {
      return { ok: false, error: `Insufficient free stock. Free: ${free}` }
    }
    return applyMovement(get, set, 'issue', input, 'SUBCON_OUT', -1, input.workOrderId)
  },

  postSubcontractIn: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Receive quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    return applyMovement(get, set, 'inward', input, 'SUBCON_IN', 1, input.workOrderId)
  },

  getWoReservedQty: (woNo, itemId, warehouseId) =>
    get().reservations
      .filter(
        (r) =>
          r.status === 'active' &&
          r.demandType === 'WO' &&
          r.demandId === woNo &&
          r.itemId === itemId &&
          r.warehouseId === warehouseId,
      )
      .reduce((sum, r) => sum + r.qty, 0),

  postAdjustment: (input) => {
    if (input.qty <= 0) return { ok: false, error: 'Adjustment quantity must be positive' }
    const v = validateItemWarehouse(input.itemId, input.warehouseId)
    if (!v.ok) return v
    if (!input.isPositive) {
      const free = get().getFreeQty(input.itemId, input.warehouseId)
      if (input.qty > free) {
        return { ok: false, error: `Cannot adjust — only ${free} free stock available` }
      }
    }
    const sign = input.isPositive ? 1 : -1
    return applyMovement(get, set, 'adjustment', input, 'ADJ', sign, null)
  },
    }),
    {
      name: 'vasant-erp-inventory-v1',
      storage: erpStorage,
      partialize: (s) => ({
        stockMovements: s.stockMovements,
        reservations: s.reservations,
      }),
    },
  ),
)

function applyMovement(
  get: () => InventoryState,
  set: (fn: (s: InventoryState) => Partial<InventoryState>) => void,
  movementType: StockMovementType,
  input: TxnInput,
  refType: string,
  qtySign: number,
  workOrderId: string | null = null,
  linkage?: { sourceWoId?: string | null; parentWoId?: string | null },
) {
  const { getItem } = getMasterCtx()
  const item = getItem(input.itemId)!
  const rate = input.rate ?? item.standardRate
  const signedQty = input.qty * qtySign
  const balanceAfter = computeBalanceAfter(
    get().stockMovements,
    input.itemId,
    input.warehouseId,
    signedQty,
  )
  const prefix = `${refType}-`
  const movementNo = nextMovementNo(
    prefix,
    get().stockMovements.filter((m) => m.movementNo.startsWith(prefix)).map((m) => m.movementNo),
  )
  const entry: StockMovement = {
    id: genId('sm'),
    movementNo,
    movementDate: input.txnDate ?? new Date().toISOString().slice(0, 10),
    movementType,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    qty: signedQty,
    rate,
    value: input.qty * rate,
    balanceAfter,
    referenceType: refType,
    referenceNo: input.referenceNo,
    workOrderId,
    sourceWoId: linkage?.sourceWoId ?? null,
    parentWoId: linkage?.parentWoId ?? null,
    remarks: input.remarks,
    createdBy: 'Store Admin',
    createdAt: new Date().toISOString(),
  }

  set((s) => ({ stockMovements: [entry, ...s.stockMovements] }))
  return { ok: true, movementNo }
}
