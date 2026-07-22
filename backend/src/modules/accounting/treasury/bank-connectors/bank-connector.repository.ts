import type { BankConnector, BankConnectorProvider, BankConnectorStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { BankConnectorNotFoundError, BankConnectorStaleVersionError } from './bank-connector.errors.js'
import type { ListBankConnectorsQuery } from './bank-connector.schemas.js'
import type { BankConnectorConfigJson } from './bank-connector.types.js'
import type { BankConnectorProbeStatusCode } from './bank-connector.enums.js'

function notDeleted(): Prisma.BankConnectorWhereInput {
  return { deletedAt: null }
}

export async function listConnectors(tenantId: string, query: ListBankConnectorsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.BankConnectorWhereInput = {
    tenantId,
    ...notDeleted(),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankConnector.findMany({
      where,
      skip,
      take,
      orderBy: [{ code: 'asc' }],
    }),
    prisma.bankConnector.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getConnector(tenantId: string, id: string): Promise<BankConnector> {
  const item = await prisma.bankConnector.findFirst({ where: { id, tenantId, ...notDeleted() } })
  if (!item) throw new BankConnectorNotFoundError()
  return item
}

export async function findByCode(tenantId: string, code: string, excludeId?: string): Promise<BankConnector | null> {
  return prisma.bankConnector.findFirst({
    where: {
      tenantId,
      code,
      ...notDeleted(),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export interface CreateConnectorData {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  code: string
  name: string
  provider: BankConnectorProvider
  status: BankConnectorStatus
  baseUrl: string | null
  scheduleCron: string | null
  configJson: BankConnectorConfigJson | null
  createdBy: string | null
}

export async function createConnector(data: CreateConnectorData): Promise<BankConnector> {
  return prisma.bankConnector.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      treasuryAccountId: data.treasuryAccountId,
      code: data.code.toUpperCase(),
      name: data.name,
      provider: data.provider,
      status: data.status,
      baseUrl: data.baseUrl,
      scheduleCron: data.scheduleCron,
      configJson: data.configJson === null ? Prisma.JsonNull : (data.configJson as Prisma.InputJsonValue),
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
    },
  })
}

export interface UpdateConnectorData {
  name?: string
  treasuryAccountId?: string
  baseUrl?: string | null
  scheduleCron?: string | null
  configJson?: BankConnectorConfigJson | null
  status?: BankConnectorStatus
  lastTestAt?: Date | null
  lastTestStatus?: BankConnectorProbeStatusCode | null
  lastTestMessage?: string | null
  lastSyncAt?: Date | null
  lastSyncStatus?: BankConnectorProbeStatusCode | null
  lastSyncMessage?: string | null
  updatedBy: string | null
  expectedUpdatedAt: Date
}

export async function updateConnector(tenantId: string, id: string, data: UpdateConnectorData): Promise<BankConnector> {
  const existing = await getConnector(tenantId, id)
  if (existing.updatedAt.getTime() !== data.expectedUpdatedAt.getTime()) {
    throw new BankConnectorStaleVersionError()
  }

  return prisma.bankConnector.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.treasuryAccountId !== undefined ? { treasuryAccountId: data.treasuryAccountId } : {}),
      ...(data.baseUrl !== undefined ? { baseUrl: data.baseUrl } : {}),
      ...(data.scheduleCron !== undefined ? { scheduleCron: data.scheduleCron } : {}),
      ...(data.configJson !== undefined
        ? { configJson: data.configJson === null ? Prisma.JsonNull : (data.configJson as Prisma.InputJsonValue) }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.lastTestAt !== undefined ? { lastTestAt: data.lastTestAt } : {}),
      ...(data.lastTestStatus !== undefined ? { lastTestStatus: data.lastTestStatus as never } : {}),
      ...(data.lastTestMessage !== undefined ? { lastTestMessage: data.lastTestMessage } : {}),
      ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
      ...(data.lastSyncStatus !== undefined ? { lastSyncStatus: data.lastSyncStatus as never } : {}),
      ...(data.lastSyncMessage !== undefined ? { lastSyncMessage: data.lastSyncMessage } : {}),
      updatedBy: data.updatedBy,
    },
  })
}

export async function softDeleteConnector(tenantId: string, id: string, updatedBy: string | null, expectedUpdatedAt: Date) {
  const existing = await getConnector(tenantId, id)
  if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new BankConnectorStaleVersionError()
  }
  return prisma.bankConnector.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: 'DISABLED',
      updatedBy,
    },
  })
}
