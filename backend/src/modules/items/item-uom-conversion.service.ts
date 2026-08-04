import type { MasterItemUomConversion, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { ValidationError } from '../../utils/errors.js'
import { assertValidFactor } from '../purchase/shared/uom-conversion.js'

export type ItemUomConversionInput = {
  uomId: string
  conversionFactor: number
  isPurchaseAllowed?: boolean
  isDefaultPurchase?: boolean
}

export type ItemUomConversionDto = {
  id: string
  uomId: string
  uomCode: string
  uomName: string
  conversionFactor: number
  isPurchaseAllowed: boolean
  isDefaultPurchase: boolean
}

const conversionInclude = {
  uom: { select: { id: true, code: true, name: true } },
} as const

function asFactor(value: unknown, uomId: string, baseUomId: string): number {
  if (uomId === baseUomId) return 1
  return assertValidFactor(value ?? 1)
}

/** Normalize client rows: ensure base UOM present, single default, unique uomIds. */
export function normalizeItemUomConversionInputs(
  baseUomId: string,
  rows: ItemUomConversionInput[] | undefined | null,
): ItemUomConversionInput[] {
  const list = [...(rows ?? [])]
  const byUom = new Map<string, ItemUomConversionInput>()

  for (const row of list) {
    const uomId = String(row.uomId ?? '').trim()
    if (!uomId) continue
    byUom.set(uomId, {
      uomId,
      conversionFactor: asFactor(row.conversionFactor, uomId, baseUomId),
      isPurchaseAllowed: row.isPurchaseAllowed !== false,
      isDefaultPurchase: Boolean(row.isDefaultPurchase),
    })
  }

  if (!byUom.has(baseUomId)) {
    byUom.set(baseUomId, {
      uomId: baseUomId,
      conversionFactor: 1,
      isPurchaseAllowed: true,
      isDefaultPurchase: false,
    })
  } else {
    const base = byUom.get(baseUomId)!
    byUom.set(baseUomId, { ...base, conversionFactor: 1 })
  }

  const normalized = [...byUom.values()]
  const purchaseAllowed = normalized.filter((r) => r.isPurchaseAllowed)
  if (purchaseAllowed.length === 0) {
    throw new ValidationError('At least one UOM mapping must allow purchase')
  }

  const defaults = normalized.filter((r) => r.isDefaultPurchase && r.isPurchaseAllowed)
  if (defaults.length > 1) {
    throw new ValidationError('Only one UOM mapping can be marked as default purchase')
  }
  if (defaults.length === 0) {
    const fallback = purchaseAllowed[0]!
    normalized.forEach((r) => {
      r.isDefaultPurchase = r.uomId === fallback.uomId
    })
  } else if (!defaults[0]!.isPurchaseAllowed) {
    throw new ValidationError('Default purchase UOM must have purchase allowed')
  }

  return normalized
}

/** Sync legacy MasterItem purchase columns from conversion rows. */
export function deriveLegacyPurchaseFields(
  baseUomId: string,
  rows: Array<Pick<ItemUomConversionInput, 'uomId' | 'conversionFactor' | 'isDefaultPurchase' | 'isPurchaseAllowed'>>,
): {
  purchaseUomId: string
  uomConversionFactor: number
  purchaseQtyPerUom: number
} {
  const defaultRow =
    rows.find((r) => r.isDefaultPurchase && r.isPurchaseAllowed) ??
    rows.find((r) => r.isPurchaseAllowed) ??
    rows.find((r) => r.uomId === baseUomId)
  if (!defaultRow) {
    return { purchaseUomId: baseUomId, uomConversionFactor: 1, purchaseQtyPerUom: 1 }
  }
  const sameAsBase = defaultRow.uomId === baseUomId
  const factor = sameAsBase ? 1 : asFactor(defaultRow.conversionFactor, defaultRow.uomId, baseUomId)
  return {
    purchaseUomId: defaultRow.uomId,
    uomConversionFactor: factor,
    purchaseQtyPerUom: factor,
  }
}

export function mapConversionRow(
  row: MasterItemUomConversion & { uom: { id: string; code: string; name: string } },
): ItemUomConversionDto {
  return {
    id: row.id,
    uomId: row.uomId,
    uomCode: row.uom.code,
    uomName: row.uom.name,
    conversionFactor: Number(row.conversionFactor),
    isPurchaseAllowed: row.isPurchaseAllowed,
    isDefaultPurchase: row.isDefaultPurchase,
  }
}

export async function listItemUomConversions(
  tenantId: string,
  itemId: string,
): Promise<ItemUomConversionDto[]> {
  const rows = await prisma.masterItemUomConversion.findMany({
    where: { tenantId, itemId },
    include: conversionInclude,
    orderBy: [{ isDefaultPurchase: 'desc' }, { uom: { code: 'asc' } }],
  })
  return rows.map(mapConversionRow)
}

export async function syncItemUomConversions(
  tenantId: string,
  itemId: string,
  baseUomId: string,
  inputs: ItemUomConversionInput[] | undefined | null,
  tx: Prisma.TransactionClient = prisma,
): Promise<ItemUomConversionDto[]> {
  const normalized = normalizeItemUomConversionInputs(baseUomId, inputs)

  for (const row of normalized) {
    const uom = await tx.masterUom.findFirst({
      where: { id: row.uomId, ...tenantActiveFilter(tenantId) },
      select: { id: true },
    })
    if (!uom) throw new ValidationError(`UOM ${row.uomId} not found in tenant`)
  }

  await tx.masterItemUomConversion.deleteMany({ where: { tenantId, itemId } })
  if (normalized.length > 0) {
    await tx.masterItemUomConversion.createMany({
      data: normalized.map((row) => ({
        tenantId,
        itemId,
        uomId: row.uomId,
        conversionFactor: row.conversionFactor,
        isPurchaseAllowed: row.isPurchaseAllowed !== false,
        isDefaultPurchase: Boolean(row.isDefaultPurchase),
      })),
    })
  }

  const legacy = deriveLegacyPurchaseFields(baseUomId, normalized)
  await tx.masterItem.update({
    where: { id: itemId, tenantId },
    data: {
      purchaseUomId: legacy.purchaseUomId,
      uomConversionFactor: legacy.uomConversionFactor,
      purchaseQtyPerUom: legacy.purchaseQtyPerUom,
    },
  })

  const saved = await tx.masterItemUomConversion.findMany({
    where: { tenantId, itemId },
    include: conversionInclude,
    orderBy: [{ isDefaultPurchase: 'desc' }, { uom: { code: 'asc' } }],
  })
  return saved.map(mapConversionRow)
}

/** Build conversion rows from legacy single purchase UOM fields (create/backfill). */
export function legacyFieldsToConversionInputs(
  baseUomId: string,
  purchaseUomId: string | null | undefined,
  factor: number,
): ItemUomConversionInput[] {
  const purchase = purchaseUomId && purchaseUomId !== baseUomId ? purchaseUomId : null
  const rows: ItemUomConversionInput[] = [
    {
      uomId: baseUomId,
      conversionFactor: 1,
      isPurchaseAllowed: true,
      isDefaultPurchase: !purchase,
    },
  ]
  if (purchase) {
    rows.push({
      uomId: purchase,
      conversionFactor: factor > 0 ? factor : 1,
      isPurchaseAllowed: true,
      isDefaultPurchase: true,
    })
  }
  return rows
}

export type PurchaseLineUomResolution = {
  uomId: string
  conversionFactor: number
}

type ConversionRow = {
  uomId: string
  conversionFactor: unknown
  isPurchaseAllowed: boolean
  isDefaultPurchase: boolean
}

/** Resolve PO line UOM from item mappings; validates against allowed purchase UOMs. */
export function resolvePurchaseLineUomFromMappings(input: {
  baseUomId: string
  legacyPurchaseUomId?: string | null
  legacyFactor?: unknown
  conversions: ConversionRow[]
  requestedUomId?: string | null
}): PurchaseLineUomResolution {
  const purchaseRows = input.conversions.filter((c) => c.isPurchaseAllowed)
  const fallbackLegacy = (): PurchaseLineUomResolution => {
    const uomId = input.legacyPurchaseUomId ?? input.baseUomId
    const same = !input.legacyPurchaseUomId || input.legacyPurchaseUomId === input.baseUomId
    const factor = same ? 1 : assertValidFactor(input.legacyFactor ?? 1)
    return { uomId, conversionFactor: factor }
  }

  if (purchaseRows.length === 0) {
    return fallbackLegacy()
  }

  const defaultRow =
    purchaseRows.find((c) => c.isDefaultPurchase) ??
    purchaseRows.find((c) => c.uomId === input.baseUomId) ??
    purchaseRows[0]!

  const targetUomId = input.requestedUomId ?? defaultRow.uomId
  const match = purchaseRows.find((c) => c.uomId === targetUomId)
  if (!match) {
    throw new ValidationError(
      'UOM is not an allowed purchase unit for this item. Choose from configured item UOM mappings.',
    )
  }

  const factor =
    match.uomId === input.baseUomId ? 1 : asFactor(match.conversionFactor, match.uomId, input.baseUomId)
  return { uomId: match.uomId, conversionFactor: factor }
}

export async function loadItemPurchaseUomContext(
  tenantId: string,
  itemIds: string[],
): Promise<
  Map<
    string,
    {
      baseUomId: string
      legacyPurchaseUomId: string | null
      legacyFactor: number
      conversions: ConversionRow[]
    }
  >
> {
  if (!itemIds.length) return new Map()
  const items = await prisma.masterItem.findMany({
    where: { tenantId, id: { in: itemIds }, deletedAt: null },
    select: {
      id: true,
      baseUomId: true,
      purchaseUomId: true,
      uomConversionFactor: true,
      purchaseQtyPerUom: true,
      uomConversions: {
        select: {
          uomId: true,
          conversionFactor: true,
          isPurchaseAllowed: true,
          isDefaultPurchase: true,
        },
      },
    },
  })
  return new Map(
    items.map((item) => [
      item.id,
      {
        baseUomId: item.baseUomId,
        legacyPurchaseUomId: item.purchaseUomId,
        legacyFactor: Number(item.uomConversionFactor ?? item.purchaseQtyPerUom ?? 1),
        conversions: item.uomConversions,
      },
    ]),
  )
}
