/**
 * Planning consolidation — group demand by Item + UOM + Delivery location without merging PR documents.
 * Document-level PurchasePlanningRow remains the system of record.
 */

export type PlanningRowForGroup = {
  id: string
  itemId: string | null
  itemCode: string
  itemName: string
  itemDescription?: string | null
  uomId: string | null
  uomCode?: string | null
  /** PR / line delivery warehouse (or empty). */
  deliveryLocationId: string | null
  requiredQuantity: number
  netPurchaseQuantity: number
  requiredDate: string | null
  purchaseRequisitionId: string
  purchaseRequisitionNumber: string
  purchaseRequisitionLineId: string
  preferredVendorId?: string | null
  selectedVendorId?: string | null
  preferredVendorName?: string | null
  selectedVendorName?: string | null
  expectedRate: number
  negotiatedRate?: number | null
  status: string
  planningNumber: string
}

export type ConsolidatedPlanningMember = {
  planningRowId: string
  planningNumber: string
  purchaseRequisitionId: string
  purchaseRequisitionNumber: string
  purchaseRequisitionLineId: string
  requiredQuantity: number
  netPurchaseQuantity: number
  requiredDate: string | null
  status: string
  preferredVendorId: string | null
  selectedVendorId: string | null
  expectedRate: number
  negotiatedRate: number | null
}

export type ConsolidatedPlanningGroup = {
  groupKey: string
  itemId: string | null
  itemCode: string
  itemName: string
  description: string
  uomId: string | null
  deliveryLocationId: string | null
  totalRequiredQty: number
  totalNetQty: number
  prCount: number
  earliestRequiredDate: string | null
  suggestedVendors: Array<{ id: string; name: string; frequency: number }>
  members: ConsolidatedPlanningMember[]
  planningRowIds: string[]
}

/** Stable group key: item | uom | location (uses code fallbacks when ids missing). */
export function buildPlanningConsolidationKey(input: {
  itemId?: string | null
  itemCode?: string | null
  uomId?: string | null
  deliveryLocationId?: string | null
}): string {
  const item = (input.itemId || input.itemCode || '').trim() || '_'
  const uom = (input.uomId || '').trim() || '_'
  const loc = (input.deliveryLocationId || '').trim() || '_'
  return `${item}::${uom}::${loc}`.toLowerCase()
}

function rowQty(row: PlanningRowForGroup): number {
  const net = Number(row.netPurchaseQuantity) || 0
  if (net > 0) return net
  return Math.max(0, Number(row.requiredQuantity) || 0)
}

/**
 * Build consolidated groups from open-capable planning rows.
 * Does not mutate or drop document rows.
 */
export function consolidatePlanningRows(rows: PlanningRowForGroup[]): ConsolidatedPlanningGroup[] {
  const map = new Map<string, PlanningRowForGroup[]>()
  for (const row of rows) {
    const key = buildPlanningConsolidationKey({
      itemId: row.itemId,
      itemCode: row.itemCode,
      uomId: row.uomId,
      deliveryLocationId: row.deliveryLocationId,
    })
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }

  const groups: ConsolidatedPlanningGroup[] = []
  for (const [groupKey, members] of map) {
    const first = members[0]
    const vendorFreq = new Map<string, { id: string; name: string; frequency: number }>()
    for (const m of members) {
      const vid = (m.selectedVendorId || m.preferredVendorId || '').trim()
      if (!vid) continue
      const name = m.selectedVendorName || m.preferredVendorName || vid
      const cur = vendorFreq.get(vid) ?? { id: vid, name, frequency: 0 }
      cur.frequency += 1
      vendorFreq.set(vid, cur)
    }

    const reqDates = members
      .map((m) => m.requiredDate)
      .filter((d): d is string => Boolean(d))
      .sort()

    const totalNet = members.reduce((s, m) => s + rowQty(m), 0)
    const totalRequired = members.reduce((s, m) => s + (Number(m.requiredQuantity) || 0), 0)
    const prIds = new Set(members.map((m) => m.purchaseRequisitionId))

    groups.push({
      groupKey,
      itemId: first.itemId,
      itemCode: first.itemCode,
      itemName: first.itemName,
      description: first.itemDescription || first.itemName || first.itemCode,
      uomId: first.uomId,
      deliveryLocationId: first.deliveryLocationId,
      totalRequiredQty: Number(totalRequired.toFixed(4)),
      totalNetQty: Number(totalNet.toFixed(4)),
      prCount: prIds.size,
      earliestRequiredDate: reqDates[0] ?? null,
      suggestedVendors: [...vendorFreq.values()].sort((a, b) => b.frequency - a.frequency),
      members: members
        .slice()
        .sort((a, b) => (a.requiredDate ?? '').localeCompare(b.requiredDate ?? ''))
        .map((m) => ({
          planningRowId: m.id,
          planningNumber: m.planningNumber,
          purchaseRequisitionId: m.purchaseRequisitionId,
          purchaseRequisitionNumber: m.purchaseRequisitionNumber,
          purchaseRequisitionLineId: m.purchaseRequisitionLineId,
          requiredQuantity: Number(m.requiredQuantity) || 0,
          netPurchaseQuantity: rowQty(m),
          requiredDate: m.requiredDate,
          status: m.status,
          preferredVendorId: m.preferredVendorId ?? null,
          selectedVendorId: m.selectedVendorId ?? null,
          expectedRate: Number(m.expectedRate) || 0,
          negotiatedRate: m.negotiatedRate != null ? Number(m.negotiatedRate) : null,
        })),
      planningRowIds: members.map((m) => m.id),
    })
  }

  return groups.sort((a, b) => a.itemCode.localeCompare(b.itemCode) || a.itemName.localeCompare(b.itemName))
}

export type VendorAllocationInput = {
  vendorId: string
  quantity: number
  rate: number
}

export type QtySlice = {
  planningRowId: string
  purchaseRequisitionId: string
  purchaseRequisitionLineId: string
  purchaseRequisitionNumber: string
  planningNumber: string
  quantity: number
}

/**
 * FIFO distribute a vendor allocation qty across member rows by earliest required date.
 * Remaining demand on later PRs is left for subsequent vendor allocations.
 */
export function allocateVendorQtyFifo(
  members: Array<{
    planningRowId: string
    purchaseRequisitionId: string
    purchaseRequisitionLineId: string
    purchaseRequisitionNumber: string
    planningNumber: string
    remainingQty: number
    requiredDate: string | null
  }>,
  vendorQty: number,
): { slices: QtySlice[]; members: typeof members } {
  let left = Number(vendorQty) || 0
  if (left <= 0) return { slices: [], members }

  const ordered = members
    .slice()
    .sort((a, b) => (a.requiredDate ?? '9999').localeCompare(b.requiredDate ?? '9999'))

  const slices: QtySlice[] = []
  for (const m of ordered) {
    if (left <= 0) break
    const take = Math.min(m.remainingQty, left)
    if (take <= 0) continue
    slices.push({
      planningRowId: m.planningRowId,
      purchaseRequisitionId: m.purchaseRequisitionId,
      purchaseRequisitionLineId: m.purchaseRequisitionLineId,
      purchaseRequisitionNumber: m.purchaseRequisitionNumber,
      planningNumber: m.planningNumber,
      quantity: Number(take.toFixed(4)),
    })
    m.remainingQty = Number((m.remainingQty - take).toFixed(4))
    left = Number((left - take).toFixed(4))
  }

  return { slices, members: ordered }
}

/**
 * Validate vendor allocations for create-PO.
 * Partial raise is allowed: 0 < sum(allocation) ≤ required (within 0.0001).
 * Residual open qty stays on planning / PR for a later raise.
 */
export function assertAllocationBalances(requiredQty: number, allocations: VendorAllocationInput[]): void {
  if (!allocations.length) {
    throw new Error('At least one vendor allocation is required.')
  }
  const sum = allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0)
  if (!(sum > 0)) {
    throw new Error('Allocated quantity must be greater than zero.')
  }
  if (sum - requiredQty > 0.0001) {
    throw new Error(
      `Allocated quantity (${sum}) cannot exceed required quantity (${requiredQty}).`,
    )
  }
  for (const a of allocations) {
    if (!(a.quantity > 0)) throw new Error('Each vendor allocation quantity must be greater than zero.')
    if (!(a.rate > 0)) throw new Error('Each vendor allocation requires a rate greater than zero.')
    if (!a.vendorId?.trim()) throw new Error('Each vendor allocation requires a vendor.')
  }
}
