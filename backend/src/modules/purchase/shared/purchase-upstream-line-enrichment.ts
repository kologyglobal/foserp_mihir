import { ValidationError } from '../../../utils/errors.js'
import { prisma } from '../../../config/prisma.js'
import {
  resolvePurchaseLineTaxSnapshot,
  type PurchaseLineTaxSnapshot,
} from './purchase-tax-snapshot.js'

export type PurchaseUpstreamTaxLine = {
  itemId: string | null
  itemCodeSnapshot?: string
  itemNameSnapshot?: string
  hsnId?: string | null
  gstGroupId?: string | null
  hsnCodeSnapshot?: string
  gstGroupCodeSnapshot?: string
} & Partial<PurchaseLineTaxSnapshot>

export type UpstreamTaxSource = {
  hsnId?: string | null
  gstGroupId?: string | null
  hsnCodeSnapshot?: string | null
  gstGroupCodeSnapshot?: string | null
  gstRatePctSnapshot?: unknown
  cgstRateSnapshot?: unknown
  sgstRateSnapshot?: unknown
  igstRateSnapshot?: unknown
  gstSchemeSnapshot?: string | null
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function copyUpstreamTaxSnapshots(
  line: PurchaseUpstreamTaxLine,
  source: UpstreamTaxSource | null | undefined,
): boolean {
  if (!source) return false
  const hasTax =
    Boolean(source.hsnCodeSnapshot?.trim()) ||
    num(source.gstRatePctSnapshot) > 0 ||
    Boolean(source.gstGroupCodeSnapshot?.trim())
  if (!hasTax) return false
  line.hsnId = source.hsnId ?? line.hsnId ?? null
  line.gstGroupId = source.gstGroupId ?? line.gstGroupId ?? null
  line.hsnCodeSnapshot = source.hsnCodeSnapshot ?? line.hsnCodeSnapshot ?? ''
  line.gstGroupCodeSnapshot = source.gstGroupCodeSnapshot ?? line.gstGroupCodeSnapshot ?? ''
  line.gstRatePctSnapshot = num(source.gstRatePctSnapshot)
  line.cgstRateSnapshot = num(source.cgstRateSnapshot)
  line.sgstRateSnapshot = num(source.sgstRateSnapshot)
  line.igstRateSnapshot = num(source.igstRateSnapshot)
  line.gstSchemeSnapshot = source.gstSchemeSnapshot ?? line.gstSchemeSnapshot ?? 'cgst_sgst'
  return true
}

export function toUpstreamTaxPersistFields(line: PurchaseUpstreamTaxLine) {
  return {
    hsnId: line.hsnId ?? null,
    gstGroupId: line.gstGroupId ?? null,
    hsnCodeSnapshot: line.hsnCodeSnapshot ?? '',
    gstGroupCodeSnapshot: line.gstGroupCodeSnapshot ?? '',
    gstRatePctSnapshot: line.gstRatePctSnapshot ?? 0,
    cgstRateSnapshot: line.cgstRateSnapshot ?? 0,
    sgstRateSnapshot: line.sgstRateSnapshot ?? 0,
    igstRateSnapshot: line.igstRateSnapshot ?? 0,
    gstSchemeSnapshot: line.gstSchemeSnapshot ?? 'cgst_sgst',
  }
}

export async function enrichPurchaseUpstreamLinesWithTax(
  tenantId: string,
  lines: PurchaseUpstreamTaxLine[],
  taxContext?: {
    asOfDate?: Date | string | null
    vendorId?: string | null
    deliveryWarehouseId?: string | null
  },
  getUpstreamSource?: (
    line: PurchaseUpstreamTaxLine,
    index: number,
  ) => UpstreamTaxSource | null | undefined,
): Promise<PurchaseUpstreamTaxLine[]> {
  for (let i = 0; i < lines.length; i++) {
    const src = getUpstreamSource?.(lines[i], i)
    if (src) copyUpstreamTaxSnapshots(lines[i], src)
  }

  const itemIds = [...new Set(lines.map((l) => l.itemId).filter((v): v is string => Boolean(v)))]
  const items = itemIds.length
    ? await prisma.masterItem.findMany({
        where: { tenantId, id: { in: itemIds }, deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          hsnId: true,
          hsnCode: true,
          gstGroupId: true,
        },
      })
    : []
  const itemsById = new Map(items.map((i) => [i.id, i]))

  const gstGroupIds = [
    ...new Set(
      lines
        .map((l) => l.gstGroupId ?? (l.itemId ? itemsById.get(l.itemId)?.gstGroupId : null))
        .filter((v): v is string => Boolean(v)),
    ),
  ]
  const hsnIds = [
    ...new Set(
      lines
        .map((l) => l.hsnId ?? (l.itemId ? itemsById.get(l.itemId)?.hsnId : null))
        .filter((v): v is string => Boolean(v)),
    ),
  ]

  const [gstGroups, hsns] = await Promise.all([
    gstGroupIds.length
      ? prisma.masterGstGroup.findMany({
          where: { tenantId, id: { in: gstGroupIds }, deletedAt: null },
          select: { id: true, code: true },
        })
      : [],
    hsnIds.length
      ? prisma.masterHsnCode.findMany({
          where: { tenantId, id: { in: hsnIds }, deletedAt: null },
          select: { id: true, code: true, gstGroupId: true },
        })
      : [],
  ])

  const gstById = new Map(gstGroups.map((g) => [g.id, g]))
  const hsnById = new Map(hsns.map((h) => [h.id, h]))

  for (const line of lines) {
    const item = line.itemId ? itemsById.get(line.itemId) : undefined
    if (item) {
      if (!line.itemCodeSnapshot) line.itemCodeSnapshot = item.code
      if (!line.itemNameSnapshot) line.itemNameSnapshot = item.name
      if (line.gstGroupId == null && item.gstGroupId) line.gstGroupId = item.gstGroupId
      if (line.hsnId == null && item.hsnId) line.hsnId = item.hsnId
      if (!line.hsnCodeSnapshot && item.hsnCode) line.hsnCodeSnapshot = item.hsnCode
    }

    if (line.hsnId) {
      const hsn = hsnById.get(line.hsnId)
      if (!hsn) throw new ValidationError('HSN code not found in tenant')
      line.hsnCodeSnapshot = hsn.code
      if (line.gstGroupId && line.gstGroupId !== hsn.gstGroupId) {
        throw new ValidationError('HSN code does not belong to the selected GST group')
      }
      if (!line.gstGroupId) line.gstGroupId = hsn.gstGroupId
    }

    if (line.gstGroupId) {
      const group = gstById.get(line.gstGroupId)
      if (!group) throw new ValidationError('GST group not found in tenant')
      line.gstGroupCodeSnapshot = group.code
    }

    const tax = await resolvePurchaseLineTaxSnapshot({
      tenantId,
      itemId: line.itemId,
      hsnId: line.hsnId,
      gstGroupId: line.gstGroupId,
      asOfDate: taxContext?.asOfDate,
      vendorId: taxContext?.vendorId,
      deliveryWarehouseId: taxContext?.deliveryWarehouseId,
    })
    Object.assign(line, tax)
  }

  return lines
}
