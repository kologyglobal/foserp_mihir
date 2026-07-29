/**
 * FIN-CLOSE-1 — Inventory ↔ GL / WIP ↔ GL trial balance (read-only).
 *
 * Compares operational inventory / WIP / open GR/IR values to mapped GL account
 * balances. Never mutates balances and never exposes a Force Balance action.
 */
import type { DefaultAccountMappingKey, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { formatForPersistence, isZero, subtract, toDecimal } from '../shared/finance-decimal.js'
import { isInventoryAccountingEnabled } from '../../inventory/accounting/inventory-accounting-gate.service.js'
import { isManufacturingAccountingEnabled } from '../../manufacturing/accounting/manufacturing-accounting-gate.service.js'
import type {
  InventoryGlAccountKey,
  InventoryGlReasonCode,
  InventoryGlTrialBalanceResult,
  InventoryGlTrialBalanceRow,
} from './inventory-gl-reconciliation.types.js'

const D = (v: Prisma.Decimal.Value = 0) => toDecimal(v)
const DEFAULT_TOLERANCE = D('0.01')

const RM_ITEM_TYPES = new Set([
  'raw_material',
  'raw-material',
  'consumable',
  'spare',
  'spare_part',
  'packing',
  'packaging',
])
const FG_ITEM_TYPES = new Set([
  'finished_good',
  'finished_goods',
  'semi_finished',
  'semi-finished',
  'sfg',
  'fg',
])

async function resolveLegalEntity(tenantId: string, legalEntityId?: string | null) {
  if (legalEntityId) {
    const le = await prisma.legalEntity.findFirst({
      where: { id: legalEntityId, tenantId, isActive: true },
      select: { id: true },
    })
    if (!le) throw new NotFoundError('Legal entity not found')
    return le.id
  }
  const def = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!def) throw new ValidationError('No active legal entity for inventory/GL reconciliation')
  return def.id
}

async function loadMappings(tenantId: string, legalEntityId: string, keys: InventoryGlAccountKey[]) {
  const rows = await prisma.defaultAccountMapping.findMany({
    where: {
      tenantId,
      legalEntityId,
      mappingKey: { in: keys as DefaultAccountMappingKey[] },
    },
    include: {
      account: { select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true } },
    },
  })
  return new Map(rows.map((r) => [r.mappingKey as InventoryGlAccountKey, r]))
}

/** Asset accounts: debit − credit. Liability (GR/IR): credit − debit. */
async function glBalance(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  asOfDate: Date,
  convention: 'ASSET' | 'LIABILITY',
) {
  const agg = await prisma.generalLedgerEntry.aggregate({
    where: {
      tenantId,
      legalEntityId,
      accountId,
      postingDate: { lte: asOfDate },
    },
    _sum: { baseDebitAmount: true, baseCreditAmount: true },
  })
  const debit = D(agg._sum.baseDebitAmount ?? 0)
  const credit = D(agg._sum.baseCreditAmount ?? 0)
  return convention === 'ASSET' ? debit.sub(credit) : credit.sub(debit)
}

async function stockValueByBucket(tenantId: string) {
  const balances = await prisma.inventoryStockBalance.findMany({
    where: { tenantId },
    select: {
      stockValue: true,
      item: { select: { itemType: true } },
    },
  })
  let raw = D(0)
  let fg = D(0)
  let other = D(0)
  for (const row of balances) {
    const value = D(row.stockValue ?? 0)
    const type = (row.item.itemType ?? '').toLowerCase()
    if (RM_ITEM_TYPES.has(type)) raw = raw.add(value)
    else if (FG_ITEM_TYPES.has(type)) fg = fg.add(value)
    else other = other.add(value)
  }
  // Unclassified stockable items are treated as RM (purchase/inventory default).
  return { rawMaterial: raw.add(other), finishedGoods: fg }
}

async function operationalWip(tenantId: string) {
  const snapshots = await prisma.workOrderCostSnapshot.findMany({
    where: { tenantId },
    orderBy: [{ productionOrderId: 'asc' }, { snapshotVersion: 'desc' }],
    distinct: ['productionOrderId'],
    select: { productionOrderId: true, totalActualCost: true },
  })
  const fgByWo = await prisma.productionAccountingEvent.groupBy({
    by: ['productionOrderId'],
    where: {
      tenantId,
      eventType: 'FINISHED_GOODS_RECEIVED',
      status: 'POSTED',
      productionOrderId: { not: null },
    },
    _sum: { amount: true },
  })
  const fgMap = new Map(fgByWo.map((r) => [r.productionOrderId as string, D(r._sum.amount ?? 0)]))
  return snapshots.reduce((sum, snap) => {
    const fg = fgMap.get(snap.productionOrderId) ?? D(0)
    const wip = D(snap.totalActualCost).sub(fg)
    return sum.add(wip.greaterThan(0) ? wip : D(0))
  }, D(0))
}

/**
 * Open GR/IR = POSTED GRN_INWARD receipt cost still uninvoiced (by posted VI qty).
 * Matches the GR/IR release semantics used on Vendor Invoice post.
 */
async function openGrirOperational(tenantId: string, legalEntityId: string) {
  const events = await prisma.inventoryAccountingEvent.findMany({
    where: {
      tenantId,
      legalEntityId,
      eventType: 'GRN_INWARD',
      status: 'POSTED',
      movementId: { not: null },
    },
    select: { movementId: true, amount: true },
  })
  if (events.length === 0) return D(0)

  const movements = await prisma.inventoryStockMovement.findMany({
    where: { tenantId, id: { in: events.map((e) => e.movementId!).filter(Boolean) } },
    select: { id: true, idempotencyKey: true, quantity: true },
  })
  const movementById = new Map(movements.map((m) => [m.id, m]))
  const amountByMovement = new Map(events.map((e) => [e.movementId!, D(e.amount)]))

  const grnLineIds: string[] = []
  const receiptByLine = new Map<string, { qty: ReturnType<typeof D>; amount: ReturnType<typeof D> }>()
  for (const [movementId, amount] of amountByMovement) {
    const movement = movementById.get(movementId)
    const key = movement?.idempotencyKey ?? ''
    const match = /^grn-in:([^:]+):(.+)$/.exec(key)
    if (!match) continue
    const grnLineId = match[2]!
    grnLineIds.push(grnLineId)
    const qty = D(movement?.quantity ?? 0).abs()
    receiptByLine.set(grnLineId, { qty, amount })
  }
  if (receiptByLine.size === 0) {
    // Fallback: all posted GRN_INWARD still open when movement keys are non-standard.
    return events.reduce((s, e) => s.add(D(e.amount)), D(0))
  }

  const invoiced = await prisma.vendorInvoiceLine.findMany({
    where: {
      tenantId,
      legalEntityId,
      sourceLinkType: 'GOODS_RECEIPT',
      sourceDocumentLineId: { in: grnLineIds },
      vendorInvoice: { tenantId, status: 'POSTED' },
    },
    select: { sourceDocumentLineId: true, quantity: true },
  })
  const invoicedQty = new Map<string, ReturnType<typeof D>>()
  for (const row of invoiced) {
    if (!row.sourceDocumentLineId) continue
    invoicedQty.set(
      row.sourceDocumentLineId,
      (invoicedQty.get(row.sourceDocumentLineId) ?? D(0)).add(D(row.quantity).abs()),
    )
  }

  let open = D(0)
  for (const [lineId, receipt] of receiptByLine) {
    if (isZero(receipt.qty)) continue
    const billed = invoicedQty.get(lineId) ?? D(0)
    const remainingQty = receipt.qty.sub(billed)
    if (remainingQty.lte(0)) continue
    const unit = receipt.amount.div(receipt.qty)
    open = open.add(unit.mul(remainingQty).toDecimalPlaces(4))
  }
  return open
}

async function eventCounts(
  tenantId: string,
  legalEntityId: string,
  source: 'INVENTORY' | 'MANUFACTURING',
) {
  if (source === 'INVENTORY') {
    const [failed, unposted] = await Promise.all([
      prisma.inventoryAccountingEvent.count({
        where: { tenantId, legalEntityId, status: 'FAILED' },
      }),
      prisma.inventoryAccountingEvent.count({
        where: { tenantId, legalEntityId, status: 'RECORDED' },
      }),
    ])
    return { failed, unposted }
  }
  const [failed, unposted] = await Promise.all([
    prisma.productionAccountingEvent.count({
      where: { tenantId, legalEntityId, status: 'FAILED' },
    }),
    prisma.productionAccountingEvent.count({
      where: { tenantId, legalEntityId, status: 'RECORDED' },
    }),
  ])
  return { failed, unposted }
}

function buildRow(args: {
  mappingKey: InventoryGlAccountKey
  mapping: Awaited<ReturnType<typeof loadMappings>> extends Map<infer _K, infer V> ? V | undefined : never
  operational: ReturnType<typeof D>
  gl: ReturnType<typeof D>
  tolerance: ReturnType<typeof D>
  failed: number
  unposted: number
  featureOff?: boolean
  extraReasons?: InventoryGlReasonCode[]
  notes?: string[]
}): InventoryGlTrialBalanceRow {
  const account = args.mapping?.account
  const mapped = Boolean(args.mapping?.accountId && account && !account.isGroup && account.isActive)
  const difference = subtract(args.operational, args.gl)
  const absDiff = difference.abs()
  const reasonCodes: InventoryGlReasonCode[] = []
  const notes = [...(args.notes ?? [])]

  if (!mapped) reasonCodes.push('MAPPING_MISSING')
  if (args.featureOff) reasonCodes.push('FEATURE_FLAG_OFF')
  if (args.failed > 0) reasonCodes.push('ACCOUNTING_EVENT_FAILED')
  if (args.unposted > 0) reasonCodes.push('ACCOUNTING_EVENT_UNPOSTED')
  for (const code of args.extraReasons ?? []) {
    if (!reasonCodes.includes(code)) reasonCodes.push(code)
  }

  let status: InventoryGlTrialBalanceRow['status'] = 'MATCHED'
  if (!mapped) status = 'UNMAPPED'
  else if (absDiff.greaterThan(args.tolerance)) {
    status = 'DIFFERENCE'
    if (args.mappingKey === 'GRIR_CLEARING' && args.gl.greaterThan(args.tolerance)) {
      if (!reasonCodes.includes('GRIR_NOT_CLEARED')) reasonCodes.push('GRIR_NOT_CLEARED')
    } else if (!reasonCodes.includes('OPERATIONAL_VALUE_DIFFERENCE')) {
      reasonCodes.push('OPERATIONAL_VALUE_DIFFERENCE')
    }
    // If ops ≈ events but GL differs, call out possible manual journal.
    if (args.failed === 0 && args.unposted === 0 && absDiff.greaterThan(args.tolerance)) {
      notes.push('Difference may include manual GL entries or unposted source documents')
      if (!reasonCodes.includes('MANUAL_GL_ENTRY_DIFFERENCE') && absDiff.greaterThan(args.tolerance.mul(10))) {
        reasonCodes.push('MANUAL_GL_ENTRY_DIFFERENCE')
      }
    }
  } else if (args.failed > 0 || args.unposted > 0 || args.featureOff) {
    status = 'WARNING'
  }

  if (status === 'MATCHED' && reasonCodes.length === 0) reasonCodes.push('MATCHED')

  return {
    mappingKey: args.mappingKey,
    accountId: args.mapping?.accountId ?? null,
    accountCode: account?.accountCode ?? null,
    accountName: account?.accountName ?? null,
    operationalBalance: formatForPersistence(args.operational),
    glBalance: formatForPersistence(args.gl),
    difference: formatForPersistence(difference),
    status,
    reasonCodes,
    drillDown: {
      failedEventCount: args.failed,
      unpostedEventCount: args.unposted,
      notes,
    },
  }
}

export async function buildInventoryGlTrialBalance(
  tenantId: string,
  input: { legalEntityId?: string | null; asOfDate?: string | null; tolerance?: string | null },
): Promise<InventoryGlTrialBalanceResult> {
  const legalEntityId = await resolveLegalEntity(tenantId, input.legalEntityId)
  const asOfDateStr = input.asOfDate?.trim() || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDateStr)) {
    throw new ValidationError('asOfDate must be YYYY-MM-DD')
  }
  const asOfDate = new Date(`${asOfDateStr}T00:00:00.000Z`)
  const tolerance = input.tolerance ? D(input.tolerance) : DEFAULT_TOLERANCE

  const keys: InventoryGlAccountKey[] = [
    'RAW_MATERIAL_INVENTORY',
    'FINISHED_GOODS_INVENTORY',
    'WIP_INVENTORY',
    'GRIR_CLEARING',
  ]
  const [mappings, stock, wip, openGrir, invEnabled, mfgEnabled, invCounts, mfgCounts] =
    await Promise.all([
      loadMappings(tenantId, legalEntityId, keys),
      stockValueByBucket(tenantId),
      operationalWip(tenantId),
      openGrirOperational(tenantId, legalEntityId),
      isInventoryAccountingEnabled(tenantId, legalEntityId),
      isManufacturingAccountingEnabled(tenantId, legalEntityId),
      eventCounts(tenantId, legalEntityId, 'INVENTORY'),
      eventCounts(tenantId, legalEntityId, 'MANUFACTURING'),
    ])

  const glFor = async (key: InventoryGlAccountKey, convention: 'ASSET' | 'LIABILITY') => {
    const mapping = mappings.get(key)
    if (!mapping?.accountId) return D(0)
    return glBalance(tenantId, legalEntityId, mapping.accountId, asOfDate, convention)
  }

  const [rmGl, fgGl, wipGl, grirGl] = await Promise.all([
    glFor('RAW_MATERIAL_INVENTORY', 'ASSET'),
    glFor('FINISHED_GOODS_INVENTORY', 'ASSET'),
    glFor('WIP_INVENTORY', 'ASSET'),
    glFor('GRIR_CLEARING', 'LIABILITY'),
  ])

  const rows: InventoryGlTrialBalanceRow[] = [
    buildRow({
      mappingKey: 'RAW_MATERIAL_INVENTORY',
      mapping: mappings.get('RAW_MATERIAL_INVENTORY'),
      operational: stock.rawMaterial,
      gl: rmGl,
      tolerance,
      failed: invCounts.failed,
      unposted: invCounts.unposted,
      featureOff: !invEnabled,
      notes: ['Operational = stock balance value for RM / unclassified items'],
    }),
    buildRow({
      mappingKey: 'FINISHED_GOODS_INVENTORY',
      mapping: mappings.get('FINISHED_GOODS_INVENTORY'),
      operational: stock.finishedGoods,
      gl: fgGl,
      tolerance,
      failed: invCounts.failed + mfgCounts.failed,
      unposted: invCounts.unposted + mfgCounts.unposted,
      featureOff: !invEnabled && !mfgEnabled,
      notes: ['Operational = stock balance value for finished / semi-finished items'],
    }),
    buildRow({
      mappingKey: 'WIP_INVENTORY',
      mapping: mappings.get('WIP_INVENTORY'),
      operational: wip,
      gl: wipGl,
      tolerance,
      failed: mfgCounts.failed,
      unposted: mfgCounts.unposted,
      featureOff: !mfgEnabled,
      notes: ['Operational = latest WO cost snapshot − posted FG capitalisation'],
    }),
    buildRow({
      mappingKey: 'GRIR_CLEARING',
      mapping: mappings.get('GRIR_CLEARING'),
      operational: openGrir,
      gl: grirGl,
      tolerance,
      failed: invCounts.failed,
      unposted: invCounts.unposted,
      featureOff: !invEnabled,
      extraReasons: openGrir.greaterThan(tolerance) && grirGl.greaterThan(tolerance) && openGrir.sub(grirGl).abs().greaterThan(tolerance)
        ? undefined
        : grirGl.greaterThan(tolerance) && openGrir.lessThanOrEqualTo(tolerance)
          ? ['GRIR_NOT_CLEARED']
          : undefined,
      notes: ['Operational = posted GRN inward receipt cost still uninvoiced'],
    }),
  ]

  const absoluteDifference = rows.reduce((s, r) => s.add(D(r.difference).abs()), D(0))
  return {
    legalEntityId,
    asOfDate: asOfDateStr,
    generatedAt: new Date().toISOString(),
    tolerance: formatForPersistence(tolerance),
    inventoryAccountingEnabled: invEnabled,
    manufacturingAccountingEnabled: mfgEnabled,
    rows,
    totals: {
      matched: rows.filter((r) => r.status === 'MATCHED').length,
      differences: rows.filter((r) => r.status === 'DIFFERENCE').length,
      unmapped: rows.filter((r) => r.status === 'UNMAPPED').length,
      warnings: rows.filter((r) => r.status === 'WARNING').length,
      absoluteDifference: formatForPersistence(absoluteDifference),
    },
    forceBalanceAllowed: false,
    actions: ['REFRESH', 'OPEN_FAILED_EVENTS', 'OPEN_EVENT', 'OPEN_VOUCHER', 'RETRY'],
  }
}
