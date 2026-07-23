import { prisma } from '../../../config/database.js'
import { freeQty } from '../shared/balance.service.js'
import { dec } from '../shared/quantity.helpers.js'

export type InventoryLookupMatch =
  | {
      kind: 'ITEM'
      itemId: string
      itemCode: string
      itemName: string
      warehouseId: string | null
      freeQty: string | null
      lotId: null
      lotNumber: null
      serialId: null
      serialNumber: null
    }
  | {
      kind: 'LOT'
      itemId: string
      itemCode: string
      itemName: string
      warehouseId: string | null
      freeQty: string
      lotId: string
      lotNumber: string
      serialId: null
      serialNumber: null
    }
  | {
      kind: 'SERIAL'
      itemId: string
      itemCode: string
      itemName: string
      warehouseId: string | null
      freeQty: string
      lotId: string | null
      lotNumber: null
      serialId: string
      serialNumber: string
    }

/** Resolve a scan string to item / lot / serial for kiosk & barcode scan flows. */
export async function lookupInventoryCode(
  tenantId: string,
  rawCode: string,
  warehouseId?: string,
): Promise<{ matches: InventoryLookupMatch[] }> {
  const code = rawCode.trim()
  if (!code) return { matches: [] }

  const matches: InventoryLookupMatch[] = []

  const [item, lots, serials] = await Promise.all([
    prisma.masterItem.findFirst({
      where: { tenantId, deletedAt: null, code: { equals: code } },
      select: { id: true, code: true, name: true },
    }),
    prisma.inventoryLot.findMany({
      where: {
        tenantId,
        deletedAt: null,
        lotNumber: { equals: code },
        ...(warehouseId ? { warehouseId } : {}),
      },
      take: 20,
      include: { item: { select: { id: true, code: true, name: true } } },
    }),
    prisma.inventorySerial.findMany({
      where: {
        tenantId,
        deletedAt: null,
        serialNumber: { equals: code },
        ...(warehouseId ? { warehouseId } : {}),
      },
      take: 20,
      include: { item: { select: { id: true, code: true, name: true } } },
    }),
  ])

  if (item) {
    let qty: string | null = null
    if (warehouseId) {
      const bal = await prisma.inventoryStockBalance.findUnique({
        where: {
          tenantId_itemId_warehouseId: { tenantId, itemId: item.id, warehouseId },
        },
      })
      qty = bal ? dec(freeQty(bal)) : '0'
    }
    matches.push({
      kind: 'ITEM',
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      warehouseId: warehouseId ?? null,
      freeQty: qty,
      lotId: null,
      lotNumber: null,
      serialId: null,
      serialNumber: null,
    })
  }

  for (const lot of lots) {
    matches.push({
      kind: 'LOT',
      itemId: lot.itemId,
      itemCode: lot.item.code,
      itemName: lot.item.name,
      warehouseId: lot.warehouseId,
      freeQty: dec(lot.quantityOnHand),
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      serialId: null,
      serialNumber: null,
    })
  }

  for (const serial of serials) {
    matches.push({
      kind: 'SERIAL',
      itemId: serial.itemId,
      itemCode: serial.item.code,
      itemName: serial.item.name,
      warehouseId: serial.warehouseId,
      freeQty: '1',
      lotId: serial.lotId,
      lotNumber: null,
      serialId: serial.id,
      serialNumber: serial.serialNumber,
    })
  }

  return { matches }
}
