import { prisma } from '../../../../../config/database.js'
import type { Prisma } from '@prisma/client'
import {
  BankStatementMappingTemplateNameConflictError,
  BankStatementMappingTemplateNotFoundError,
  BankStatementMappingTemplateStaleVersionError,
} from '../../treasury.errors.js'
import type { ListMappingTemplatesQuery } from './bank-statement-mapping-template.schemas.js'

function assertUpdatedAt(current: Date, expectedUpdatedAt?: string) {
  if (!expectedUpdatedAt) return
  if (current.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new BankStatementMappingTemplateStaleVersionError()
  }
}

export async function listTemplates(tenantId: string, query: ListMappingTemplatesQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where: Prisma.BankStatementColumnMappingTemplateWhereInput = {
    tenantId,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
    ...(query.importFormat ? { importFormat: query.importFormat } : {}),
    ...(query.isActive != null ? { isActive: query.isActive } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankStatementColumnMappingTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bankStatementColumnMappingTemplate.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getTemplateOrThrow(tenantId: string, id: string) {
  const item = await prisma.bankStatementColumnMappingTemplate.findFirst({ where: { id, tenantId } })
  if (!item) throw new BankStatementMappingTemplateNotFoundError()
  return item
}

export async function createTemplate(
  tenantId: string,
  data: {
    legalEntityId: string
    treasuryAccountId?: string | null
    bankNameKey?: string | null
    name: string
    importFormat: 'CSV' | 'XLSX' | 'MANUAL'
    isDefault?: boolean
    sheetNamePattern?: string | null
    headerRowNumber?: number | null
    dataStartRowNumber?: number | null
    delimiter?: string | null
    encoding?: string | null
    mappingConfig: Prisma.InputJsonValue
    parsingConfig?: Prisma.InputJsonValue
    createdById?: string | null
  },
) {
  const existing = await prisma.bankStatementColumnMappingTemplate.findFirst({
    where: { tenantId, legalEntityId: data.legalEntityId, name: data.name },
  })
  if (existing) throw new BankStatementMappingTemplateNameConflictError()

  return prisma.bankStatementColumnMappingTemplate.create({
    data: {
      tenantId,
      legalEntityId: data.legalEntityId,
      treasuryAccountId: data.treasuryAccountId ?? null,
      bankNameKey: data.bankNameKey?.trim().toUpperCase() ?? null,
      name: data.name,
      importFormat: data.importFormat,
      isDefault: data.isDefault ?? false,
      sheetNamePattern: data.sheetNamePattern ?? null,
      headerRowNumber: data.headerRowNumber ?? null,
      dataStartRowNumber: data.dataStartRowNumber ?? null,
      delimiter: data.delimiter ?? null,
      encoding: data.encoding ?? null,
      mappingConfig: data.mappingConfig,
      parsingConfig: data.parsingConfig,
      createdById: data.createdById ?? null,
      updatedById: data.createdById ?? null,
    },
  })
}

export async function updateTemplate(
  tenantId: string,
  id: string,
  data: Prisma.BankStatementColumnMappingTemplateUpdateInput,
  expectedUpdatedAt?: string,
) {
  const existing = await getTemplateOrThrow(tenantId, id)
  assertUpdatedAt(existing.updatedAt, expectedUpdatedAt)
  if (typeof data.name === 'string' && data.name !== existing.name) {
    const conflict = await prisma.bankStatementColumnMappingTemplate.findFirst({
      where: { tenantId, legalEntityId: existing.legalEntityId, name: data.name, NOT: { id } },
    })
    if (conflict) throw new BankStatementMappingTemplateNameConflictError()
  }
  return prisma.bankStatementColumnMappingTemplate.update({ where: { id }, data })
}

export async function setTemplateActive(
  tenantId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt?: string,
) {
  const existing = await getTemplateOrThrow(tenantId, id)
  assertUpdatedAt(existing.updatedAt, expectedUpdatedAt)
  return prisma.bankStatementColumnMappingTemplate.update({ where: { id }, data: { isActive } })
}
