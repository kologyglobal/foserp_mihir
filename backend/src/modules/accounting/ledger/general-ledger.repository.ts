/**
 * General Ledger repository — IMMUTABLE.
 *
 * Application-level immutability is mandatory: posted GL rows must never be
 * updated or deleted. DB triggers for immutability are deferred to a later phase.
 *
 * This module intentionally exposes insert + read operations only.
 */

import type { GeneralLedgerEntry, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'

/** Type-level proof that this repository has no mutating methods beyond insertMany. */
export type ImmutableGlRepository = {
  insertMany: typeof insertMany
  findByVoucherId: typeof findByVoucherId
  findByAccount: typeof findByAccount
  findByParty: typeof findByParty
  findBySourceDocument: typeof findBySourceDocument
  findByPeriod: typeof findByPeriod
}

export const GL_REPOSITORY_IMMUTABLE = true as const

export async function insertMany(data: Prisma.GeneralLedgerEntryCreateManyInput[]): Promise<number> {
  if (data.length === 0) return 0
  const result = await prisma.generalLedgerEntry.createMany({ data })
  return result.count
}

export async function findByVoucherId(tenantId: string, voucherId: string): Promise<GeneralLedgerEntry[]> {
  return prisma.generalLedgerEntry.findMany({
    where: { tenantId, voucherId },
    orderBy: [{ lineNumber: 'asc' }],
  })
}

export async function findByAccount(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  fromDate?: string,
  toDate?: string,
): Promise<GeneralLedgerEntry[]> {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  return prisma.generalLedgerEntry.findMany({
    where: {
      tenantId,
      legalEntityId,
      accountId,
      ...(fromDate || toDate
        ? {
            postingDate: {
              ...(fromDate ? { gte: parseDateOnly(fromDate) } : {}),
              ...(toDate ? { lte: parseDateOnly(toDate) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
  })
}

export async function findByParty(
  tenantId: string,
  legalEntityId: string,
  partyType: string,
  partyId: string,
  fromDate?: string,
  toDate?: string,
): Promise<GeneralLedgerEntry[]> {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  return prisma.generalLedgerEntry.findMany({
    where: {
      tenantId,
      legalEntityId,
      partyType: partyType as never,
      partyId,
      ...(fromDate || toDate
        ? {
            postingDate: {
              ...(fromDate ? { gte: parseDateOnly(fromDate) } : {}),
              ...(toDate ? { lte: parseDateOnly(toDate) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
  })
}

export async function findBySourceDocument(
  tenantId: string,
  legalEntityId: string,
  sourceModule: string,
  sourceDocumentType: string,
  sourceDocumentId: string,
): Promise<GeneralLedgerEntry[]> {
  return prisma.generalLedgerEntry.findMany({
    where: { tenantId, legalEntityId, sourceModule, sourceDocumentType, sourceDocumentId },
    orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
  })
}

export async function findByPeriod(
  tenantId: string,
  legalEntityId: string,
  accountingPeriodId: string,
): Promise<GeneralLedgerEntry[]> {
  return prisma.generalLedgerEntry.findMany({
    where: { tenantId, legalEntityId, accountingPeriodId },
    orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
  })
}

export const generalLedgerRepository: ImmutableGlRepository = {
  insertMany,
  findByVoucherId,
  findByAccount,
  findByParty,
  findBySourceDocument,
  findByPeriod,
}
