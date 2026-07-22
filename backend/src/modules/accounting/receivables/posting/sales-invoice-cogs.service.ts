/**
 * Optional COGS pairing on sales invoice post (O2C Wave 3).
 *
 * Gated by env `ENABLE_SI_COGS_POSTING` (default OFF). When enabled, resolves FG cost from
 * OUTBOUND_DISPATCH source links → dispatch line inventory movement rate × linked qty.
 * Posts Dr COST_OF_GOODS_SOLD / Cr FINISHED_GOODS_INVENTORY when cost and both accounts exist;
 * otherwise skips silently (revenue posting is unchanged).
 */
import type { DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import {
  add,
  formatForPersistence,
  isPositive,
  isZero,
  multiply,
  toDecimal,
} from '../../shared/finance-decimal.js'
import { env } from '../../../../config/env.js'
import type { SalesInvoiceWithLines } from '../sales-invoices/sales-invoice.types.js'

export interface SalesInvoiceCogsPostingContext {
  totalCogsAmount: string
  cogsAccountId: string
  fgInventoryAccountId: string
}

export function isSiCogsPostingEnabled(): boolean {
  return env.ENABLE_SI_COGS_POSTING
}

async function resolveDefaultMappingAccountId(
  tenantId: string,
  legalEntityId: string,
  mappingKey: DefaultAccountMappingKey,
): Promise<string | null> {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    select: {
      account: { select: { id: true, isActive: true, isGroup: true } },
    },
  })
  const account = mapping?.account
  if (!account || !account.isActive || account.isGroup) return null
  return account.id
}

/** Sum FG cost for ACTIVE OUTBOUND_DISPATCH source links on the invoice. */
async function resolveFgCostAmount(
  tenantId: string,
  invoice: SalesInvoiceWithLines,
): Promise<string | null> {
  const links = (invoice.sourceLinks ?? []).filter(
    (l) => l.status === 'ACTIVE' && l.sourceType === 'OUTBOUND_DISPATCH' && l.sourceLineId,
  )
  if (links.length === 0) return null

  const lineIds = [...new Set(links.map((l) => l.sourceLineId!).filter(Boolean))]
  const dispatchLines = await prisma.outboundDispatchLine.findMany({
    where: { tenantId, id: { in: lineIds } },
    select: { id: true, inventoryMovementId: true },
  })
  const movementIdByLine = new Map(dispatchLines.map((l) => [l.id, l.inventoryMovementId]))
  const movementIds = [...new Set(dispatchLines.map((l) => l.inventoryMovementId).filter(Boolean))] as string[]

  const movementRateById = new Map<string, ReturnType<typeof toDecimal>>()
  if (movementIds.length > 0) {
    const movements = await prisma.inventoryStockMovement.findMany({
      where: { tenantId, id: { in: movementIds } },
      select: { id: true, rate: true },
    })
    for (const m of movements) {
      movementRateById.set(m.id, toDecimal(m.rate))
    }
  }

  let total = toDecimal(0)
  for (const link of links) {
    const movementId = movementIdByLine.get(link.sourceLineId!)
    if (!movementId) continue
    const rate = movementRateById.get(movementId)
    if (!rate || isZero(rate)) continue
    const lineCost = multiply(rate, link.quantity)
    if (isPositive(lineCost)) {
      total = add(total, lineCost)
    }
  }

  const amount = formatForPersistence(total)
  return isZero(amount) ? null : amount
}

export async function resolveSalesInvoiceCogsPostingContext(
  tenantId: string,
  invoice: SalesInvoiceWithLines,
): Promise<SalesInvoiceCogsPostingContext | null> {
  if (!isSiCogsPostingEnabled()) return null

  const totalCogsAmount = await resolveFgCostAmount(tenantId, invoice)
  if (!totalCogsAmount) return null

  const [cogsAccountId, fgInventoryAccountId] = await Promise.all([
    resolveDefaultMappingAccountId(tenantId, invoice.legalEntityId, 'COST_OF_GOODS_SOLD'),
    resolveDefaultMappingAccountId(tenantId, invoice.legalEntityId, 'FINISHED_GOODS_INVENTORY'),
  ])

  if (!cogsAccountId || !fgInventoryAccountId) return null

  return { totalCogsAmount, cogsAccountId, fgInventoryAccountId }
}
