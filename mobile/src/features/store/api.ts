/**
 * Store / manufacturing materials API — live REST only.
 * Issue requires manufacturing.materials.issue + body.idempotencyKey.
 */
import { apiClient, tenantPath } from '@/api/client'
import { canAny } from '@/auth/permissions'

export type StorePermissions = string[] | null | undefined

export function canAccessMaterialIssue(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['manufacturing.materials.issue', 'tenant.manage'], permissions)
}

export function canAccessMaterialReturn(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['manufacturing.materials.return', 'tenant.manage'], permissions)
}

export function canViewMaterials(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    [
      'manufacturing.materials.view',
      'manufacturing.materials.issue',
      'manufacturing.materials.return',
      'tenant.manage',
    ],
    permissions,
  )
}

export function canViewWorkOrders(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    [
      'manufacturing.work_orders.view',
      'manufacturing.materials.issue',
      'manufacturing.materials.return',
      'tenant.manage',
    ],
    permissions,
  )
}

export function canViewStock(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    ['inventory.stock.view', 'inventory.view', 'inventory.view_item_ledger', 'tenant.manage'],
    permissions,
  )
}

export function canViewStockCounts(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.stock_count.view', 'inventory.view', 'tenant.manage'], permissions)
}

export function canCreateStockCount(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    ['inventory.stock_count.create', 'inventory.count.create', 'inventory.create', 'tenant.manage'],
    permissions,
  )
}

export function canCountStock(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.stock_count.count', 'inventory.count.create', 'tenant.manage'], permissions)
}

export function canSubmitStockCount(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.stock_count.review', 'inventory.submit', 'tenant.manage'], permissions)
}

/** View transfer list / detail (backend anyOf). */
export function canViewTransfers(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.transfers.view', 'inventory.view', 'tenant.manage'], permissions)
}

export function canCreateTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    ['inventory.transfers.create', 'inventory.transfer.create', 'inventory.create', 'tenant.manage'],
    permissions,
  )
}

export function canSubmitTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.submit', 'inventory.transfer.create', 'tenant.manage'], permissions)
}

export function canApproveTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.transfer.approve', 'inventory.approve', 'tenant.manage'], permissions)
}

export function canDispatchTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    ['inventory.transfers.dispatch', 'inventory.transfer.dispatch', 'tenant.manage'],
    permissions,
  )
}

export function canReceiveTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(
    ['inventory.transfers.receive', 'inventory.transfer.receive', 'tenant.manage'],
    permissions,
  )
}

export function canCancelTransfer(permissions?: StorePermissions): boolean {
  if (permissions == null) return false
  return canAny(['inventory.transfers.cancel', 'inventory.cancel', 'tenant.manage'], permissions)
}

export interface WorkOrderSummary {
  id: string
  orderNumber?: string
  status?: string
  productName?: string
  itemName?: string
  [key: string]: unknown
}

export interface MaterialItemRef {
  id?: string
  code?: string
  name?: string
  batchTracked?: boolean
  serialTracked?: boolean
}

export interface WorkOrderMaterialLine {
  id: string
  productionOrderId?: string
  itemId?: string
  item?: MaterialItemRef | null
  itemCode?: string
  itemName?: string
  requiredQty?: number | string
  reservedQty?: number | string
  issuedQty?: number | string
  returnedQty?: number | string
  shortageQty?: number | string
  freeQty?: number | string | null
  hasShortage?: boolean
  status?: string
  warehouseId?: string | null
  warehouse?: { id?: string; name?: string; code?: string } | null
  uom?: { code?: string; name?: string } | null
  remarks?: string | null
  [key: string]: unknown
}

export interface MasterItemSummary {
  id: string
  code?: string
  name?: string
  [key: string]: unknown
}

export interface WarehouseSummary {
  id: string
  code?: string
  name?: string
  status?: string
  [key: string]: unknown
}

export interface StockBalanceRow {
  id?: string
  itemId?: string
  warehouseId?: string
  onHandQty?: number | string
  reservedQty?: number | string
  availableQty?: number | string
  quantity?: number | string
  item?: { id?: string; code?: string; name?: string } | null
  warehouse?: { id?: string; code?: string; name?: string } | null
  itemCode?: string
  itemName?: string
  warehouseName?: string
  [key: string]: unknown
}

export interface StockCountLine {
  id: string
  itemId?: string
  countedQty?: number | string | null
  systemQty?: number | string | null
  varianceQty?: number | string | null
  remarks?: string | null
  item?: { id?: string; code?: string; name?: string } | null
  [key: string]: unknown
}

export interface StockCountDoc {
  id: string
  countNumber?: string
  status?: string
  warehouseId?: string
  warehouse?: { id?: string; code?: string; name?: string } | null
  countDate?: string
  remarks?: string | null
  lines?: StockCountLine[]
  [key: string]: unknown
}

function qs(params: Record<string, string | number | boolean | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false) continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

function unwrapList<T>(data: T[] | { items?: T[]; data?: T[] } | null | undefined): T[] {
  if (data == null) return []
  if (Array.isArray(data)) return data
  return data.items ?? data.data ?? []
}

export function remainingToIssue(line: WorkOrderMaterialLine): number {
  const required = Number(line.requiredQty ?? 0)
  const issued = Number(line.issuedQty ?? 0)
  const returned = Number(line.returnedQty ?? 0)
  const remaining = required - issued + returned
  return remaining > 0 ? remaining : 0
}

export function netIssued(line: WorkOrderMaterialLine): number {
  const issued = Number(line.issuedQty ?? 0)
  const returned = Number(line.returnedQty ?? 0)
  const net = issued - returned
  return net > 0 ? net : 0
}

export function materialLabel(line: WorkOrderMaterialLine): string {
  return (
    line.item?.code ||
    line.itemCode ||
    line.item?.name ||
    line.itemName ||
    line.id.slice(0, 8)
  )
}

export function materialName(line: WorkOrderMaterialLine): string {
  return line.item?.name || line.itemName || materialLabel(line)
}

/** Normalize barcode wedge input (trim control chars). */
export function normalizeScan(raw: string): string {
  return raw.replace(/[\r\n\t]/g, '').trim()
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/**
 * Extract WO search token from free text / QR payloads.
 * Accepts UUID, plain WO number, or `WO:XXXX` / path fragments.
 */
export function extractWorkOrderScan(raw: string): string {
  const t = normalizeScan(raw)
  if (!t) return ''
  if (isUuid(t)) return t
  const woLabel = t.match(/(?:^|[/\s])WO[:#\-]?([A-Z0-9\-_/]+)$/i)
  if (woLabel?.[1]) return woLabel[1]
  const path = t.match(/work-orders\/([0-9a-f-]{36})/i)
  if (path?.[1]) return path[1]
  return t
}

export function createIssueIdempotencyKey(workOrderId: string, materialId: string): string {
  const raw = `m-iss-${workOrderId.slice(0, 8)}-${materialId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return raw.slice(0, 150)
}

export function createReturnIdempotencyKey(workOrderId: string, materialId: string): string {
  const raw = `m-ret-${workOrderId.slice(0, 8)}-${materialId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return raw.slice(0, 150)
}

export async function listWorkOrders(params: {
  search?: string
  page?: number
  limit?: number
  status?: string
} = {}): Promise<WorkOrderSummary[]> {
  const search = params.search ? extractWorkOrderScan(params.search) : undefined
  // UUID → fetch single by id via list search fallback
  if (search && isUuid(search)) {
    try {
      const one = await getWorkOrder(search)
      return one ? [one] : []
    } catch {
      // fall through to search
    }
  }
  const res = await apiClient.get<WorkOrderSummary[] | { items?: WorkOrderSummary[] }>(
    tenantPath(
      `/manufacturing/work-orders${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search,
        status: params.status,
      })}`,
    ),
  )
  return unwrapList(res.data)
}

export async function getWorkOrder(id: string): Promise<WorkOrderSummary> {
  const res = await apiClient.get<WorkOrderSummary>(tenantPath(`/manufacturing/work-orders/${id}`))
  return res.data
}

export async function listWorkOrderMaterials(workOrderId: string): Promise<WorkOrderMaterialLine[]> {
  const res = await apiClient.get<WorkOrderMaterialLine[] | { items?: WorkOrderMaterialLine[] }>(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials`),
  )
  return unwrapList(res.data)
}

export type IssueMaterialInput = {
  materialId: string
  quantity: number
  idempotencyKey: string
  remarks?: string
  warehouseId?: string
  additional?: boolean
  batchNumber?: string
  serialNumber?: string
}

export async function issueWorkOrderMaterial(workOrderId: string, data: IssueMaterialInput) {
  const res = await apiClient.post(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/issue`),
    data,
    { retries: 0 },
  )
  return res.data
}

export async function returnWorkOrderMaterial(
  workOrderId: string,
  data: {
    materialId: string
    quantity: number
    idempotencyKey?: string
    remarks?: string
    batchNumber?: string
  },
) {
  const res = await apiClient.post(
    tenantPath(`/manufacturing/work-orders/${workOrderId}/materials/return`),
    data,
    { retries: 0 },
  )
  return res.data
}

export async function listMasterItems(params: { search?: string; limit?: number } = {}) {
  const res = await apiClient.get<MasterItemSummary[] | { items?: MasterItemSummary[] }>(
    tenantPath(
      `/masters/items${qs({
        page: 1,
        limit: params.limit ?? 30,
        search: params.search ? normalizeScan(params.search) : undefined,
      })}`,
    ),
  )
  return unwrapList(res.data)
}

export async function listWarehouses(params: { search?: string; limit?: number } = {}) {
  const res = await apiClient.get<WarehouseSummary[] | { items?: WarehouseSummary[] }>(
    tenantPath(
      `/masters/warehouses${qs({
        page: 1,
        limit: params.limit ?? 50,
        search: params.search,
        status: 'ACTIVE',
      })}`,
    ),
  )
  return unwrapList(res.data)
}

export async function listStockBalances(params: {
  itemId?: string
  warehouseId?: string
  page?: number
  limit?: number
} = {}): Promise<StockBalanceRow[]> {
  const res = await apiClient.get<StockBalanceRow[] | { items?: StockBalanceRow[] }>(
    tenantPath(
      `/inventory/balances${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        itemId: params.itemId,
        warehouseId: params.warehouseId,
      })}`,
    ),
  )
  return unwrapList(res.data)
}

/** Resolve scan/search text → balances (item code search then balances by itemId). */
export async function searchStockByCode(search: string): Promise<{
  items: MasterItemSummary[]
  balances: StockBalanceRow[]
}> {
  const code = normalizeScan(search)
  if (!code) return { items: [], balances: [] }
  const items = await listMasterItems({ search: code, limit: 20 })
  if (items.length === 0) return { items: [], balances: [] }
  const primary = items[0]!
  const balances = await listStockBalances({ itemId: primary.id, limit: 50 })
  return { items, balances }
}

export async function listStockCounts(params: {
  page?: number
  limit?: number
  status?: string
  warehouseId?: string
} = {}): Promise<StockCountDoc[]> {
  const res = await apiClient.get<StockCountDoc[] | { items?: StockCountDoc[] }>(
    tenantPath(
      `/inventory/stock-counts${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 40,
        status: params.status,
        warehouseId: params.warehouseId,
      })}`,
    ),
  )
  return unwrapList(res.data)
}

export async function getStockCount(id: string): Promise<StockCountDoc> {
  const res = await apiClient.get<StockCountDoc>(tenantPath(`/inventory/stock-counts/${id}`))
  return res.data
}

export async function createStockCount(payload: {
  warehouseId: string
  remarks?: string
}): Promise<StockCountDoc> {
  const res = await apiClient.post<StockCountDoc>(
    tenantPath('/inventory/stock-counts'),
    payload,
    { retries: 0 },
  )
  return res.data
}

export async function snapshotStockCount(id: string): Promise<StockCountDoc> {
  const res = await apiClient.post<StockCountDoc>(
    tenantPath(`/inventory/stock-counts/${id}/snapshot`),
    {},
    { retries: 0 },
  )
  return res.data
}

export async function enterStockCounts(
  id: string,
  lines: Array<{ lineId: string; countedQty: number; remarks?: string }>,
): Promise<StockCountDoc> {
  const res = await apiClient.put<StockCountDoc>(
    tenantPath(`/inventory/stock-counts/${id}/counts`),
    { lines },
    { retries: 0 },
  )
  return res.data
}

export async function submitStockCount(id: string, remarks?: string): Promise<StockCountDoc> {
  const res = await apiClient.post<StockCountDoc>(
    tenantPath(`/inventory/stock-counts/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

// ─── Stock transfers ────────────────────────────────────────────────────────

export interface TransferLine {
  id: string
  itemId?: string
  quantity?: number | string
  dispatchedQty?: number | string
  receivedQty?: number | string
  batchNumberSnapshot?: string | null
  serialNumberSnapshot?: string | null
  remarks?: string | null
  item?: { id?: string; code?: string; name?: string } | null
  [key: string]: unknown
}

export interface TransferDoc {
  id: string
  transferNumber?: string
  status?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  fromWarehouse?: { id?: string; code?: string; name?: string } | null
  toWarehouse?: { id?: string; code?: string; name?: string } | null
  transferDate?: string
  remarks?: string | null
  lines?: TransferLine[]
  [key: string]: unknown
}

export type CreateTransferLineInput = {
  itemId: string
  quantity: number
  batchId?: string
  batchNumber?: string
  serialId?: string
  serialNumber?: string
  remarks?: string
}

export function createTransferDispatchKey(transferId: string): string {
  const raw = `m-tr-disp-${transferId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return raw.slice(0, 100)
}

export function createTransferReceiveKey(transferId: string): string {
  const raw = `m-tr-recv-${transferId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return raw.slice(0, 100)
}

export async function listTransfers(params: {
  page?: number
  limit?: number
  status?: string
  warehouseId?: string
} = {}): Promise<TransferDoc[]> {
  const res = await apiClient.get<TransferDoc[] | { items?: TransferDoc[] }>(
    tenantPath(
      `/inventory/transfers${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 40,
        status: params.status,
        warehouseId: params.warehouseId,
      })}`,
    ),
  )
  return unwrapList(res.data)
}

export async function getTransfer(id: string): Promise<TransferDoc> {
  const res = await apiClient.get<TransferDoc>(tenantPath(`/inventory/transfers/${id}`))
  return res.data
}

export async function createTransfer(payload: {
  fromWarehouseId: string
  toWarehouseId: string
  remarks?: string
  lines: CreateTransferLineInput[]
}): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath('/inventory/transfers'),
    payload,
    { retries: 0 },
  )
  return res.data
}

export async function submitTransfer(id: string, remarks?: string): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath(`/inventory/transfers/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function approveTransfer(id: string, remarks?: string): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath(`/inventory/transfers/${id}/approve`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function dispatchTransfer(
  id: string,
  data: { idempotencyKey: string; remarks?: string },
): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath(`/inventory/transfers/${id}/dispatch`),
    data,
    { retries: 0 },
  )
  return res.data
}

export async function receiveTransfer(
  id: string,
  data: {
    idempotencyKey: string
    lines: Array<{ lineId: string; quantity: number }>
  },
): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath(`/inventory/transfers/${id}/receive`),
    data,
    { retries: 0 },
  )
  return res.data
}

export async function cancelTransfer(id: string, remarks?: string): Promise<TransferDoc> {
  const res = await apiClient.post<TransferDoc>(
    tenantPath(`/inventory/transfers/${id}/cancel`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

/**
 * Advance DRAFT → … → IN_TRANSIT as far as the caller's permissions allow.
 * Stops on first step the user cannot perform (returns current doc).
 */
export async function advanceTransferTowardDispatch(
  id: string,
  opts: {
    canSubmit: boolean
    canApprove: boolean
    canDispatch: boolean
    remarks?: string
    dispatchIdempotencyKey: string
  },
): Promise<TransferDoc> {
  let doc = await getTransfer(id)
  const remarks = opts.remarks

  if (doc.status === 'DRAFT' && opts.canSubmit) {
    doc = await submitTransfer(id, remarks)
  }
  if (doc.status === 'SUBMITTED' && opts.canApprove) {
    doc = await approveTransfer(id, remarks)
  }
  if (doc.status === 'APPROVED' && opts.canDispatch) {
    doc = await dispatchTransfer(id, {
      idempotencyKey: opts.dispatchIdempotencyKey,
      remarks,
    })
  }
  return doc
}

export function transferLineRemaining(line: TransferLine): number {
  const dispatched = Number(line.dispatchedQty ?? line.quantity ?? 0)
  const received = Number(line.receivedQty ?? 0)
  const rem = dispatched - received
  return rem > 0 ? rem : 0
}
