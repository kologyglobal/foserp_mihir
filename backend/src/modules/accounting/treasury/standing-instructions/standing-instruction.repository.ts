import { Prisma, type StandingInstruction } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { StandingInstructionNotFoundError, StandingInstructionStaleVersionError } from './standing-instruction.errors.js'
import type { CreateStandingInstructionInput, ListStandingInstructionsQuery, UpdateStandingInstructionInput } from './standing-instruction.schemas.js'

export async function findByIdOrThrow(tenantId: string, id: string): Promise<StandingInstruction> {
  const row = await prisma.standingInstruction.findFirst({ where: { id, tenantId } })
  if (!row) throw new StandingInstructionNotFoundError()
  return row
}

export function assertExpectedUpdatedAt(row: StandingInstruction, expectedUpdatedAt: string): void {
  if (row.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new StandingInstructionStaleVersionError()
}

export async function create(tenantId: string, input: CreateStandingInstructionInput, userId?: string | null): Promise<StandingInstruction> {
  return prisma.standingInstruction.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      treasuryAccountId: input.treasuryAccountId,
      name: input.name,
      description: input.description ?? null,
      status: 'ACTIVE',
      adjustmentType: input.adjustmentType,
      direction: input.direction,
      frequency: input.frequency,
      amountMode: input.amountMode,
      fixedAmount: input.fixedAmount != null ? new Prisma.Decimal(input.fixedAmount) : null,
      startDate: parseDateOnly(input.startDate),
      endDate: input.endDate ? parseDateOnly(input.endDate) : null,
      nextDueDate: parseDateOnly(input.startDate),
      lineTemplateJson: input.lineTemplate as unknown as Prisma.InputJsonValue,
      narrationTemplate: input.narrationTemplate ?? null,
      createdById: userId ?? null,
      updatedById: userId ?? null,
    },
  })
}

export async function update(tenantId: string, id: string, input: UpdateStandingInstructionInput, userId?: string | null): Promise<StandingInstruction> {
  const existing = await findByIdOrThrow(tenantId, id)
  assertExpectedUpdatedAt(existing, input.expectedUpdatedAt)
  return prisma.standingInstruction.update({
    where: { id, tenantId },
    data: {
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      treasuryAccountId: input.treasuryAccountId,
      name: input.name,
      description: input.description ?? null,
      adjustmentType: input.adjustmentType,
      direction: input.direction,
      frequency: input.frequency,
      amountMode: input.amountMode,
      fixedAmount: input.fixedAmount != null ? new Prisma.Decimal(input.fixedAmount) : null,
      startDate: parseDateOnly(input.startDate),
      endDate: input.endDate ? parseDateOnly(input.endDate) : null,
      lineTemplateJson: input.lineTemplate as unknown as Prisma.InputJsonValue,
      narrationTemplate: input.narrationTemplate ?? null,
      updatedById: userId ?? null,
    },
  })
}

export async function list(tenantId: string, query: ListStandingInstructionsQuery): Promise<{ items: StandingInstruction[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.StandingInstructionWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.standingInstruction.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.standingInstruction.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export async function listDueForGeneration(tenantId: string, legalEntityId: string, asOfDate: Date, standingInstructionId?: string): Promise<StandingInstruction[]> {
  return prisma.standingInstruction.findMany({
    where: {
      tenantId,
      legalEntityId,
      status: 'ACTIVE',
      nextDueDate: { lte: asOfDate },
      ...(standingInstructionId ? { id: standingInstructionId } : {}),
    },
    orderBy: { nextDueDate: 'asc' },
  })
}

export async function setStatus(tenantId: string, id: string, status: 'PAUSED' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED', userId?: string | null): Promise<StandingInstruction> {
  return prisma.standingInstruction.update({ where: { id, tenantId }, data: { status, updatedById: userId ?? null } })
}

export async function advanceNextDueDate(tenantId: string, id: string, nextDueDate: Date, lastGeneratedForDate: Date): Promise<void> {
  await prisma.standingInstruction.update({
    where: { id, tenantId },
    data: { nextDueDate, lastGeneratedAt: new Date(), lastGeneratedForDate },
  })
}
