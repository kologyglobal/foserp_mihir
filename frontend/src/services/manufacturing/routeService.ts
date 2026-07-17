/**
 * Manufacturing Route Master — demo in-memory service.
 * Routes feed Work Order operation stages (not a standalone MES).
 */

import type {
  CreateManufacturingRouteInput,
  ManufacturingRoute,
  ManufacturingRouteStatus,
} from '../../types/manufacturingRoute'
import { seedManufacturingRoutes } from '../../data/manufacturing/routeSeed'

const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms))

let routes: ManufacturingRoute[] = structuredClone(seedManufacturingRoutes)
let routeSeq = 20

function now() {
  return new Date().toISOString()
}

export async function getManufacturingRoutes(filter?: {
  search?: string
  finishedItem?: string
  status?: ManufacturingRouteStatus | ''
}): Promise<ManufacturingRoute[]> {
  await delay()
  let list = [...routes]
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.finishedItem) {
    const q = filter.finishedItem.toLowerCase()
    list = list.filter(
      (r) =>
        r.finishedItemCode.toLowerCase().includes(q)
        || r.finishedItemId === filter.finishedItem
        || r.finishedItemName.toLowerCase().includes(q),
    )
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.routeNo.toLowerCase().includes(q)
        || r.routeName.toLowerCase().includes(q)
        || r.finishedItemCode.toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => a.routeNo.localeCompare(b.routeNo))
}

export async function getManufacturingRouteById(id: string): Promise<ManufacturingRoute | null> {
  await delay()
  return routes.find((r) => r.id === id) ?? null
}

export async function getActiveRouteForFinishedItem(
  finishedItemId: string,
  bomId?: string | null,
): Promise<ManufacturingRoute | null> {
  await delay()
  const active = routes.filter((r) => r.finishedItemId === finishedItemId && r.status === 'active')
  if (!active.length) return null
  /* Prefer route linked to this BOM, else any active route for the finished item. */
  if (bomId) {
    const byBom = active.find((r) => r.defaultBomId === bomId)
    if (byBom) return structuredClone(byBom)
  }
  return structuredClone(active[0])
}

/** Deep-clone a route for WO snapshot (callers must not mutate the master). */
export async function getRouteSnapshotForWorkOrder(
  finishedItemId: string,
  options?: { bomId?: string | null; routeId?: string | null; overrideRoute?: boolean },
): Promise<ManufacturingRoute | null> {
  await delay()
  if (options?.routeId && options.overrideRoute) {
    const found = routes.find((r) => r.id === options.routeId)
    return found ? structuredClone(found) : null
  }
  return getActiveRouteForFinishedItem(finishedItemId, options?.bomId)
}

export async function createManufacturingRoute(
  input: CreateManufacturingRouteInput,
): Promise<{ ok: boolean; route?: ManufacturingRoute; error?: string }> {
  await delay()
  if (!input.routeName.trim()) return { ok: false, error: 'Route name is required' }
  if (!input.operations?.length) return { ok: false, error: 'Add at least one operation' }
  routeSeq += 1
  const id = `mfg-route-${crypto.randomUUID().slice(0, 8)}`
  const route: ManufacturingRoute = {
    id,
    routeNo: `RT-2026-${String(routeSeq).padStart(3, '0')}`,
    routeName: input.routeName.trim(),
    finishedItemId: input.finishedItemId,
    finishedItemCode: input.finishedItemCode,
    finishedItemName: input.finishedItemName,
    version: input.version?.trim() || 'v1',
    status: 'draft',
    defaultBomId: input.defaultBomId ?? null,
    defaultBomNumber: input.defaultBomNumber ?? '',
    remarks: input.remarks,
    operations: input.operations.map((op, i) => ({
      id: op.id ?? `rt-op-${id}-${op.sequenceNo || (i + 1) * 10}`,
      sequenceNo: op.sequenceNo || (i + 1) * 10,
      operationName: op.operationName,
      workCenter: op.workCenter,
      plannedTimeMinutes: op.plannedTimeMinutes,
      qcRequired: op.qcRequired,
      jobWorkRequired: op.jobWorkRequired,
      defaultVendorId: op.defaultVendorId,
      defaultVendorName: op.defaultVendorName,
      inputQtyBasis: op.inputQtyBasis,
      outputQtyBasis: op.outputQtyBasis,
      allowScrap: op.allowScrap,
      allowRework: op.allowRework,
      allowReject: op.allowReject,
      remarks: op.remarks,
    })),
    createdAt: now(),
    updatedAt: now(),
    createdBy: 'Demo User',
  }
  routes = [route, ...routes]
  return { ok: true, route }
}

export async function updateManufacturingRoute(
  id: string,
  input: CreateManufacturingRouteInput,
): Promise<{ ok: boolean; route?: ManufacturingRoute; error?: string }> {
  await delay()
  const idx = routes.findIndex((r) => r.id === id)
  if (idx < 0) return { ok: false, error: 'Route not found' }
  if (routes[idx].status === 'active') {
    /* allow edit of draft/inactive; active can soft-update remarks/ops in demo */
  }
  const next: ManufacturingRoute = {
    ...routes[idx],
    routeName: input.routeName.trim(),
    finishedItemId: input.finishedItemId,
    finishedItemCode: input.finishedItemCode,
    finishedItemName: input.finishedItemName,
    version: input.version?.trim() || routes[idx].version,
    defaultBomId: input.defaultBomId ?? null,
    defaultBomNumber: input.defaultBomNumber ?? '',
    remarks: input.remarks,
    operations: input.operations.map((op, i) => ({
      id: op.id ?? `rt-op-${id}-${op.sequenceNo || (i + 1) * 10}`,
      sequenceNo: op.sequenceNo || (i + 1) * 10,
      operationName: op.operationName,
      workCenter: op.workCenter,
      plannedTimeMinutes: op.plannedTimeMinutes,
      qcRequired: op.qcRequired,
      jobWorkRequired: op.jobWorkRequired,
      defaultVendorId: op.defaultVendorId,
      defaultVendorName: op.defaultVendorName,
      inputQtyBasis: op.inputQtyBasis,
      outputQtyBasis: op.outputQtyBasis,
      allowScrap: op.allowScrap,
      allowRework: op.allowRework,
      allowReject: op.allowReject,
      remarks: op.remarks,
    })),
    updatedAt: now(),
  }
  routes[idx] = next
  return { ok: true, route: next }
}

export async function activateManufacturingRoute(id: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = routes.findIndex((r) => r.id === id)
  if (idx < 0) return { ok: false, error: 'Not found' }
  const route = routes[idx]
  if (!route.operations.length) return { ok: false, error: 'Add operations before activate' }
  /* One active route per finished item (and soft-prefer BOM link on lookup). */
  routes = routes.map((r) =>
    r.finishedItemId === route.finishedItemId && r.id !== id && r.status === 'active'
      ? { ...r, status: 'inactive' as const, updatedAt: now() }
      : r,
  )
  routes[idx] = { ...routes[idx], status: 'active', updatedAt: now() }
  return { ok: true }
}

export async function deactivateManufacturingRoute(id: string): Promise<{ ok: boolean; error?: string }> {
  await delay()
  const idx = routes.findIndex((r) => r.id === id)
  if (idx < 0) return { ok: false, error: 'Not found' }
  routes[idx] = { ...routes[idx], status: 'inactive', updatedAt: now() }
  return { ok: true }
}
