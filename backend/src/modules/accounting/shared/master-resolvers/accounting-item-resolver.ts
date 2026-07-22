/**
 * Thin item resolver over MasterItem — no new tables.
 */
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { NotFoundError } from '../../../../utils/errors.js'

export class AccountingItemNotFoundError extends NotFoundError {
  constructor(message = 'Item not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'ACCOUNTING_ITEM_NOT_FOUND' })
  }
}

export interface AccountingItemLookupItem {
  id: string
  code: string
  name: string
  itemType: string
  productType: string | null
  baseUomId: string | null
  categoryId: string | null
  hsnCode: string | null
  hsnId: string | null
  gstGroupId: string | null
  standardRate: string | null
  status: string
  isActive: boolean
}

export interface FindAccountingItemsQuery {
  search?: string
  activeOnly?: boolean
  itemType?: string
  page?: number
  limit?: number
}

function mapItem(row: {
  id: string
  code: string
  name: string
  itemType: string
  productType: string | null
  baseUomId: string | null
  categoryId: string | null
  hsnCode: string | null
  hsnId: string | null
  gstGroupId: string | null
  standardRate: unknown
  status: string
}): AccountingItemLookupItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    itemType: row.itemType,
    productType: row.productType,
    baseUomId: row.baseUomId,
    categoryId: row.categoryId,
    hsnCode: row.hsnCode,
    hsnId: row.hsnId,
    gstGroupId: row.gstGroupId,
    standardRate: row.standardRate != null ? String(row.standardRate) : null,
    status: row.status,
    isActive: row.status === 'ACTIVE',
  }
}

const ITEM_SELECT = {
  id: true,
  code: true,
  name: true,
  itemType: true,
  productType: true,
  baseUomId: true,
  categoryId: true,
  hsnCode: true,
  hsnId: true,
  gstGroupId: true,
  standardRate: true,
  status: true,
} as const

export async function findAccountingItem(
  tenantId: string,
  itemId: string,
): Promise<AccountingItemLookupItem | null> {
  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: ITEM_SELECT,
  })
  return item ? mapItem(item) : null
}

export async function requireAccountingItem(
  tenantId: string,
  itemId: string,
): Promise<AccountingItemLookupItem> {
  const item = await findAccountingItem(tenantId, itemId)
  if (!item) throw new AccountingItemNotFoundError()
  return item
}

export async function listAccountingItems(
  tenantId: string,
  query: FindAccountingItemsQuery,
): Promise<{ items: AccountingItemLookupItem[]; total: number; page: number; limit: number }> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'asc',
  })
  const activeOnly = query.activeOnly !== false
  const where = {
    tenantId,
    deletedAt: null,
    ...(activeOnly ? { status: 'ACTIVE' as const } : {}),
    ...(query.itemType ? { itemType: query.itemType } : {}),
    ...(query.search
      ? {
          OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.masterItem.findMany({ where, skip, take, orderBy: { code: 'asc' }, select: ITEM_SELECT }),
    prisma.masterItem.count({ where }),
  ])

  return { items: rows.map(mapItem), total, page, limit }
}
