import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type {
  CreateLotInput,
  CreateSerialInput,
  ListLotsInput,
  ListSerialsInput,
} from './tracking-master.schemas.js'

const lotInclude = {
  item: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  _count: { select: { serials: true, movementLinks: true } },
} as const

const serialInclude = {
  item: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  lot: { select: { id: true, lotNumber: true, status: true } },
} as const

async function assertItemWarehouse(tenantId: string, itemId: string, warehouseId?: string) {
  const [item, warehouse] = await Promise.all([
    prisma.masterItem.findFirst({ where: { id: itemId, tenantId, deletedAt: null } }),
    warehouseId
      ? prisma.masterWarehouse.findFirst({ where: { id: warehouseId, tenantId, deletedAt: null } })
      : Promise.resolve(null),
  ])
  if (!item) throw new ValidationError('Item does not belong to this tenant')
  if (warehouseId && !warehouse) throw new ValidationError('Warehouse does not belong to this tenant')
}

export async function listLots(tenantId: string, query: ListLotsInput) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { lotNumber: { contains: query.search } },
            { heatNumber: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.inventoryLot.findMany({ where, include: lotInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.inventoryLot.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getLot(tenantId: string, id: string) {
  const lot = await prisma.inventoryLot.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      ...lotInclude,
      serials: { where: { deletedAt: null }, orderBy: { serialNumber: 'asc' } },
      movementLinks: {
        include: { stockMovement: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })
  if (!lot) throw new NotFoundError('Inventory lot not found')
  return lot
}

export async function createLot(tenantId: string, actorId: string, input: CreateLotInput) {
  await assertItemWarehouse(tenantId, input.itemId, input.warehouseId)
  const existing = await prisma.inventoryLot.findFirst({
    where: { tenantId, itemId: input.itemId, lotNumber: input.lotNumber },
  })
  if (existing) throw new ConflictError('Lot number already exists for this item')
  return prisma.inventoryLot.create({
    data: { tenantId, ...input, createdBy: actorId, updatedBy: actorId },
    include: lotInclude,
  })
}

export async function patchLotStatus(tenantId: string, id: string, actorId: string, status: string) {
  await getLot(tenantId, id)
  return prisma.inventoryLot.update({
    where: { id },
    data: { status: status as never, updatedBy: actorId },
    include: lotInclude,
  })
}

export async function listSerials(tenantId: string, query: ListSerialsInput) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.lotId ? { lotId: query.lotId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { serialNumber: { contains: query.search } } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.inventorySerial.findMany({ where, include: serialInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.inventorySerial.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getSerial(tenantId: string, id: string) {
  const serial = await prisma.inventorySerial.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { ...serialInclude, lineage: { orderBy: { createdAt: 'desc' }, take: 100 } },
  })
  if (!serial) throw new NotFoundError('Inventory serial not found')
  return serial
}

export async function createSerial(tenantId: string, actorId: string, input: CreateSerialInput) {
  await assertItemWarehouse(tenantId, input.itemId, input.warehouseId)
  if (input.lotId) {
    const lot = await prisma.inventoryLot.findFirst({
      where: { id: input.lotId, tenantId, itemId: input.itemId, deletedAt: null },
    })
    if (!lot) throw new ValidationError('Lot does not belong to this tenant and item')
  }
  const existing = await prisma.inventorySerial.findFirst({
    where: { tenantId, itemId: input.itemId, serialNumber: input.serialNumber },
  })
  if (existing) throw new ConflictError('Serial number already exists for this item')
  return prisma.inventorySerial.create({
    data: {
      tenantId,
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
      stockStatus: input.status === 'QC_HOLD' ? 'QC_HOLD' : 'UNRESTRICTED',
    },
    include: serialInclude,
  })
}

export async function patchSerialStatus(tenantId: string, id: string, actorId: string, status: string) {
  await getSerial(tenantId, id)
  return prisma.inventorySerial.update({
    where: { id },
    data: { status: status as never, updatedBy: actorId },
    include: serialInclude,
  })
}
