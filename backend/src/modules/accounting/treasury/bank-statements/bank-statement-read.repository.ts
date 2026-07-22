import { prisma } from '../../../../config/database.js'
import type { Prisma } from '@prisma/client'
import { BankStatementNotFoundError } from '../treasury.errors.js'
import type { BankStatementListFilters } from './bank-statement.types.js'

export async function listStatements(tenantId: string, filters: BankStatementListFilters) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const where: Prisma.BankStatementWhereInput = {
    tenantId,
    ...(filters.legalEntityId ? { legalEntityId: filters.legalEntityId } : {}),
    ...(filters.treasuryAccountId ? { treasuryAccountId: filters.treasuryAccountId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.importBatchId ? { importBatchId: filters.importBatchId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankStatement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        treasuryAccount: { select: { id: true, code: true, name: true, currencyCode: true } },
      },
    }),
    prisma.bankStatement.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getStatementById(tenantId: string, id: string) {
  const statement = await prisma.bankStatement.findFirst({
    where: { id, tenantId },
    include: {
      treasuryAccount: { select: { id: true, code: true, name: true, currencyCode: true, branchId: true } },
      importBatch: {
        select: {
          id: true,
          batchReference: true,
          status: true,
          importFormat: true,
          fileName: true,
        },
      },
    },
  })
  if (!statement) throw new BankStatementNotFoundError()
  return statement
}

export async function getStatementLines(tenantId: string, statementId: string) {
  return prisma.bankStatementLine.findMany({
    where: { tenantId, bankStatementId: statementId },
    orderBy: { lineNumber: 'asc' },
  })
}

export async function getImportBatchById(tenantId: string, id: string) {
  return prisma.bankStatementImportBatch.findFirst({
    where: { id, tenantId },
    include: {
      treasuryAccount: { select: { id: true, code: true, name: true, currencyCode: true } },
      mappingTemplate: { select: { id: true, name: true } },
      issues: { orderBy: { createdAt: 'asc' }, take: 500 },
      statements: { select: { id: true, statementReference: true, status: true, lineCount: true } },
    },
  })
}

export async function listImportIssuesForBatch(tenantId: string, importBatchId: string) {
  return prisma.bankStatementImportIssue.findMany({
    where: { tenantId, importBatchId },
    orderBy: [{ severity: 'desc' }, { rowNumber: 'asc' }],
  })
}
