/**
 * Thin tax / HSN / GST resolvers over existing master tables.
 * Finance engines resolve CGST/SGST/IGST from these — do not hardcode rates in forms.
 */
import type { GstTaxApplicability, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'

export class AccountingTaxMasterNotFoundError extends NotFoundError {
  constructor(message = 'Tax master not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'ACCOUNTING_TAX_MASTER_NOT_FOUND' })
  }
}

export type GstDocumentApplicability = 'SALES' | 'PURCHASE'

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
  code: string
  gstGroupId: string
  cgstRate: string
  sgstRate: string
  igstRate: string
  /** Combined GST % (CGST+SGST or IGST). */
  gstRate: string
  fromState: string
  locationStateCode: string
  dateFrom: string
  dateTo: string | null
  applicableFor: GstTaxApplicability
}

export interface ResolveLineGstInput {
  tenantId: string
  /** Document context — filters rate.applicableFor. */
  applicableFor: GstDocumentApplicability
  asOfDate?: string | null
  /** Legal-entity / plant from-state (ship-from / company state). */
  fromState?: string | null
  /** Place of supply / customer or vendor state. */
  toState?: string | null
  gstGroupId?: string | null
  hsnId?: string | null
  hsnCode?: string | null
  itemId?: string | null
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapRate(row: {
  id: string
  code: string
  gstGroupId: string
  cgst: Prisma.Decimal
  sgst: Prisma.Decimal
  igst: Prisma.Decimal
  fromState: string
  locationStateCode: string
  dateFrom: Date
  dateTo: Date | null
  applicableFor: GstTaxApplicability
}): AccountingGstRateLookup {
  const cgst = Number(row.cgst)
  const sgst = Number(row.sgst)
  const igst = Number(row.igst)
  const combined = Math.abs(cgst) + Math.abs(sgst) > 0 ? cgst + sgst : igst
  return {
    id: row.id,
    code: row.code,
    gstGroupId: row.gstGroupId,
    cgstRate: String(row.cgst),
    sgstRate: String(row.sgst),
    igstRate: String(row.igst),
    gstRate: String(combined),
    fromState: row.fromState,
    locationStateCode: row.locationStateCode,
    dateFrom: toDateOnly(row.dateFrom),
    dateTo: row.dateTo ? toDateOnly(row.dateTo) : null,
    applicableFor: row.applicableFor,
  }
}

function normState(value: string | null | undefined): string | null {
  if (!value) return null
  const t = value.trim()
  return t ? t.toLowerCase() : null
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

/**
 * Legacy helper — prefer {@link resolveLineGstFromMasters} (state + applicability aware).
 */
export async function resolveActiveGstRate(
  tenantId: string,
  gstGroupId: string,
  asOfDate?: string,
): Promise<AccountingGstRateLookup | null> {
  return resolveLineGstFromMasters({
    tenantId,
    gstGroupId,
    applicableFor: 'SALES',
    asOfDate,
  })
}

/**
 * Resolve CGST/SGST/IGST from tax masters:
 * item → HSN → GST group → dated rate lane (from/to state) + sales/purchase applicability.
 */
export async function resolveLineGstFromMasters(
  input: ResolveLineGstInput,
): Promise<AccountingGstRateLookup | null> {
  const asOf = input.asOfDate ? new Date(`${input.asOfDate}T00:00:00.000Z`) : new Date()
  let gstGroupId = input.gstGroupId ?? null
  let hsnId = input.hsnId ?? null

  if (!gstGroupId && input.itemId) {
    const item = await prisma.masterItem.findFirst({
      where: { id: input.itemId, tenantId: input.tenantId, deletedAt: null },
      select: { gstGroupId: true, hsnId: true },
    })
    if (item) {
      gstGroupId = item.gstGroupId
      hsnId = hsnId ?? item.hsnId
    }
  }

  if (!gstGroupId && hsnId) {
    const hsn = await resolveHsnById(input.tenantId, hsnId)
    gstGroupId = hsn?.gstGroupId ?? null
  }

  if (!gstGroupId && input.hsnCode) {
    const hsn = await resolveHsnByCode(input.tenantId, input.hsnCode.trim())
    gstGroupId = hsn?.gstGroupId ?? null
  }

  if (!gstGroupId) return null

  const applicabilityFilter =
    input.applicableFor === 'SALES'
      ? ({ in: ['SALES', 'BOTH'] as GstTaxApplicability[] })
      : ({ in: ['PURCHASE', 'BOTH'] as GstTaxApplicability[] })

  const candidates = await prisma.masterGstRate.findMany({
    where: {
      tenantId: input.tenantId,
      gstGroupId,
      deletedAt: null,
      status: 'ACTIVE',
      applicableFor: applicabilityFilter,
      dateFrom: { lte: asOf },
      OR: [{ dateTo: null }, { dateTo: { gte: asOf } }],
    },
    orderBy: { dateFrom: 'desc' },
  })
  if (!candidates.length) return null

  const from = normState(input.fromState)
  const to = normState(input.toState)

  const scored = candidates.map((row) => {
    let score = 0
    const rowFrom = normState(row.fromState)
    const rowTo = normState(row.locationStateCode)
    if (from && rowFrom === from) score += 4
    if (to && rowTo === to) score += 4
    if (from && to && rowFrom === from && rowTo === to) score += 8
    if (row.applicableFor === input.applicableFor) score += 2
    if (row.applicableFor === 'BOTH') score += 1
    return { row, score }
  })

  scored.sort((a, b) => b.score - a.score || b.row.dateFrom.getTime() - a.row.dateFrom.getTime())
  const best = scored[0]
  if (!best) return null
  // Prefer an exact state-lane match when states were provided; otherwise first dated row.
  if ((from || to) && best.score < 4) {
    // Fall back to any active dated rate for the group (still master-driven, not form-hardcoded).
  }
  return mapRate(best.row)
}

/** Enrich AR/AP calc lines: fill gstRate from masters when caller omitted rates. */
export async function enrichLinesWithMasterGstRates<
  T extends {
    gstRate?: string
    cgstRate?: string
    sgstRate?: string
    igstRate?: string
    itemId?: string | null
    hsnCode?: string | null
    hsnSacCode?: string | null
  },
>(
  tenantId: string,
  lines: T[],
  opts: {
    applicableFor: GstDocumentApplicability
    asOfDate?: string | null
    fromState?: string | null
    toState?: string | null
  },
): Promise<T[]> {
  const out: T[] = []
  for (const line of lines) {
    const hasExplicit =
      line.cgstRate != null ||
      line.sgstRate != null ||
      line.igstRate != null ||
      (line.gstRate != null && String(line.gstRate).trim() !== '')
    if (hasExplicit) {
      out.push(line)
      continue
    }
    const resolved = await resolveLineGstFromMasters({
      tenantId,
      applicableFor: opts.applicableFor,
      asOfDate: opts.asOfDate,
      fromState: opts.fromState,
      toState: opts.toState,
      itemId: line.itemId,
      hsnCode: line.hsnCode ?? line.hsnSacCode,
    })
    if (!resolved) {
      out.push(line)
      continue
    }
    out.push({
      ...line,
      gstRate: resolved.gstRate,
      cgstRate: resolved.cgstRate,
      sgstRate: resolved.sgstRate,
      igstRate: resolved.igstRate,
    })
  }
  return out
}
