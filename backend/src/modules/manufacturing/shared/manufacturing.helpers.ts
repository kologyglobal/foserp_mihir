import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'

export async function assertItem(tenantId: string, itemId: string) {
  const item = await prisma.masterItem.findFirst({ where: { id: itemId, ...tenantActiveFilter(tenantId) } })
  if (!item) throw new ValidationError(`Item not found in tenant: ${itemId}`)
  return item
}

export async function assertUom(tenantId: string, uomId: string) {
  const uom = await prisma.masterUom.findFirst({ where: { id: uomId, ...tenantActiveFilter(tenantId) } })
  if (!uom) throw new ValidationError(`UOM not found in tenant: ${uomId}`)
  return uom
}

export async function assertWarehouse(tenantId: string, warehouseId: string) {
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, ...tenantActiveFilter(tenantId) },
  })
  if (!warehouse) throw new ValidationError(`Warehouse not found in tenant: ${warehouseId}`)
  return warehouse
}

/** Assert warehouse exists in tenant, is not soft-deleted, and status is ACTIVE. */
export async function assertActiveWarehouse(tenantId: string, warehouseId: string) {
  const warehouse = await assertWarehouse(tenantId, warehouseId)
  if (warehouse.status !== 'ACTIVE') {
    throw new ValidationError(`Warehouse must be ACTIVE: ${warehouseId}`)
  }
  return warehouse
}

export async function assertLocation(tenantId: string, locationId: string) {
  const location = await prisma.masterLocation.findFirst({
    where: { id: locationId, ...tenantActiveFilter(tenantId) },
  })
  if (!location) throw new ValidationError(`Location not found in tenant: ${locationId}`)
  return location
}

export async function assertVendor(tenantId: string, vendorId: string) {
  const vendor = await prisma.masterVendor.findFirst({ where: { id: vendorId, ...tenantActiveFilter(tenantId) } })
  if (!vendor) throw new ValidationError(`Vendor not found in tenant: ${vendorId}`)
  return vendor
}

export async function assertWorkCentre(tenantId: string, workCentreId: string) {
  const workCentre = await prisma.manufacturingWorkCentre.findFirst({
    where: { id: workCentreId, ...tenantActiveFilter(tenantId) },
  })
  if (!workCentre) throw new ValidationError(`Work centre not found in tenant: ${workCentreId}`)
  return workCentre
}

export async function assertMachine(tenantId: string, machineId: string) {
  const machine = await prisma.manufacturingMachine.findFirst({
    where: { id: machineId, ...tenantActiveFilter(tenantId) },
  })
  if (!machine) throw new ValidationError(`Machine not found in tenant: ${machineId}`)
  return machine
}

export async function assertManufacturingProfile(tenantId: string, profileId: string) {
  const profile = await prisma.manufacturingProfile.findFirst({
    where: { id: profileId, ...tenantActiveFilter(tenantId) },
  })
  if (!profile) throw new ValidationError(`Manufacturing profile not found in tenant: ${profileId}`)
  return profile
}

/**
 * Resolve a "productId" coming from a Sales Order line (or manual input) to a
 * manufacturable MasterItem id. SO lines may carry either a MasterItem id directly,
 * or a MasterProduct id (whose `fgItemId` points at the manufactured finished-good item).
 */
export async function resolveManufacturedProductItem(tenantId: string, rawProductId: string) {
  const directItem = await prisma.masterItem.findFirst({
    where: { id: rawProductId, ...tenantActiveFilter(tenantId) },
  })
  if (directItem) return directItem

  const product = await prisma.masterProduct.findFirst({
    where: { id: rawProductId, ...tenantActiveFilter(tenantId) },
  })
  if (!product) {
    throw new ValidationError('Sales order line product could not be resolved to a manufactured item')
  }
  if (!product.fgItemId) {
    throw new ValidationError(
      `Product "${product.name}" has no linked finished-good item (fgItemId) — cannot convert to a production demand`,
    )
  }
  const fgItem = await prisma.masterItem.findFirst({
    where: { id: product.fgItemId, ...tenantActiveFilter(tenantId) },
  })
  if (!fgItem) {
    throw new ValidationError(`Finished-good item ${product.fgItemId} referenced by product ${product.code} not found`)
  }
  return fgItem
}

/**
 * Cycle-detection for a self-referencing tree (e.g. BOM line parentLineId).
 * Walks the parent chain of `proposedParentId`; throws if `nodeId` is encountered
 * (i.e. assigning `proposedParentId` as the parent of `nodeId` would create a cycle).
 */
export function assertNoTreeCycle(
  nodeId: string | null,
  proposedParentId: string | null,
  nodesById: Map<string, { id: string; parentLineId: string | null }>,
): void {
  if (!proposedParentId) return
  if (nodeId && proposedParentId === nodeId) {
    throw new ValidationError('A BOM line cannot be its own parent')
  }
  let cursor: string | null = proposedParentId
  const seen = new Set<string>()
  while (cursor) {
    if (nodeId && cursor === nodeId) {
      throw new ValidationError('Circular BOM line structure detected (parentLineId cycle)')
    }
    if (seen.has(cursor)) {
      throw new ValidationError('Circular BOM line structure detected (pre-existing cycle)')
    }
    seen.add(cursor)
    const node = nodesById.get(cursor)
    cursor = node?.parentLineId ?? null
  }
}

/**
 * DFS cycle detection for a directed graph of operation dependencies.
 * Throws if adding an edge `predecessorId -> successorId` would create a cycle
 * (i.e. `successorId` can already reach `predecessorId` through existing edges).
 */
export function assertNoDependencyCycle(
  predecessorId: string,
  successorId: string,
  edges: Array<{ predecessorOperationId: string; successorOperationId: string }>,
): void {
  if (predecessorId === successorId) {
    throw new ValidationError('An operation cannot depend on itself')
  }
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.predecessorOperationId) ?? []
    list.push(edge.successorOperationId)
    adjacency.set(edge.predecessorOperationId, list)
  }
  // If successorId can reach predecessorId via existing edges, adding predecessorId->successorId closes a cycle.
  const stack = [successorId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (current === predecessorId) {
      throw new ValidationError('Circular routing operation dependency detected')
    }
    if (visited.has(current)) continue
    visited.add(current)
    const next = adjacency.get(current) ?? []
    stack.push(...next)
  }
}

export function assertSameTenant(entityTenantId: string, tenantId: string, label: string): void {
  if (entityTenantId !== tenantId) {
    throw new NotFoundError(`${label} not found in tenant`)
  }
}
