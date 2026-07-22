/**
 * Thin tax / HSN / GST resolvers over existing master tables.
 */
import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'

export class AccountingTaxMasterNotFoundError extends NotFoundError {
  constructor(message = 'Tax master not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'ACCOUNTING_TAX_MASTER_NOT_FOUND' })
  }
}

export interface AccountingHsnLookup {
  id: string
  code: string
  description: string
  gstGroupId: string
}

export interface AccountingGstGroupLookup {
  id: string
  code: string
  goodsType: string
  description: string
}

export interface AccountingGstRateLookup {
  id: string
  gstGroupId: string
  cgstRate: string
  sgstRate: string
  igstRate: string
  fromState: string
  locationStateCode: string
  dateFrom: string
  dateTo: string | null
}

export async function resolveHsnById(tenantId: string, hsnId: string): Promise<AccountingHsnLookup | null> {
  const row = await prisma.masterHsnCode.findFirst({
    where: { id: hsnId, tenantId, deletedAt: null },
    select: { id: true, code: true, description: true, gstGroupId: true },
  })
  return row
}

export async function resolveHsnByCode(tenantId: string, code: string): Promise<AccountingHsnLookup | null> {
  const row = await prisma.masterHsnCode.findFirst({
    where: { tenantId, code, deletedAt: null },
    select: { id: true, code: true, description: true, gstGroupId: true },
  })
  return row
}

export async function resolveGstGroup(
  tenantId: string,
  gstGroupId: string,
): Promise<AccountingGstGroupLookup | null> {
  const row = await prisma.masterGstGroup.findFirst({
    where: { id: gstGroupId, tenantId, deletedAt: null },
    select: { id: true, code: true, goodsType: true, description: true },
  })
  return row
}

export async function resolveActiveGstRate(
  tenantId: string,
  gstGroupId: string,
  asOfDate?: string,
): Promise<AccountingGstRateLookup | null> {
  const asOf = asOfDate ? new Date(`${asOfDate}T00:00:00.000Z`) : new Date()
  const row = await prisma.masterGstRate.findFirst({
    where: {
      tenantId,
      gstGroupId,
      deletedAt: null,
      status: 'ACTIVE',
      dateFrom: { lte: asOf },
      OR: [{ dateTo: null }, { dateTo: { gte: asOf } }],
    },
    orderBy: { dateFrom: 'desc' },
  })
  if (!row) return null
  return {
    id: row.id,
    gstGroupId: row.gstGroupId,
    cgstRate: String(row.cgst),
    sgstRate: String(row.sgst),
    igstRate: String(row.igst),
    fromState: row.fromState,
    locationStateCode: row.locationStateCode,
    dateFrom: row.dateFrom.toISOString().slice(0, 10),
    dateTo: row.dateTo ? row.dateTo.toISOString().slice(0, 10) : null,
  }
}
