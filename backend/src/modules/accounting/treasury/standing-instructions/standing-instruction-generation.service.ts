import type { Request } from 'express'
import type { StandingInstruction } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { loadTreasuryAccountSnapshot } from '../adjustments/treasury-adjustment-account-resolver.service.js'
import { createTreasuryAdjustmentDraft } from '../adjustments/treasury-adjustment-draft.service.js'
import type { LineTemplateInput } from '../adjustments/classification/bank-posting-rule.schemas.js'
import * as repo from './standing-instruction.repository.js'
import type { GenerateDueDraftsInput } from './standing-instruction.schemas.js'
import type { CreateTreasuryAdjustmentInput } from '../adjustments/treasury-adjustment.schemas.js'

const MAX_DUE_DATES_PER_RUN = 24

function advanceDate(date: Date, frequency: StandingInstruction['frequency']): Date {
  const next = new Date(date)
  switch (frequency) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7)
      break
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1)
      break
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3)
      break
    case 'HALF_YEARLY':
      next.setUTCMonth(next.getUTCMonth() + 6)
      break
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1)
      break
  }
  return next
}

export interface GenerationOutcome {
  standingInstructionId: string
  dueDate: string
  status: 'DRAFT_CREATED' | 'SKIPPED' | 'FAILED'
  treasuryAdjustmentId: string | null
  failureReason: string | null
}

/**
 * Idempotent draft generation for due standing instructions — never auto-posts. Each due date is
 * recorded once in `StandingInstructionExecution` (unique on instruction+dueDate), so re-running
 * generate-due-drafts for an already-processed date is a no-op.
 */
export async function generateDueDrafts(req: Request, tenantId: string, input: GenerateDueDraftsInput): Promise<GenerationOutcome[]> {
  const asOfDate = input.asOfDate ? parseDateOnly(input.asOfDate) : new Date()
  const instructions = await repo.listDueForGeneration(tenantId, input.legalEntityId, asOfDate, input.standingInstructionId)

  const outcomes: GenerationOutcome[] = []

  for (const instruction of instructions) {
    let dueDate = instruction.nextDueDate
    let iterations = 0
    while (dueDate <= asOfDate && (!instruction.endDate || dueDate <= instruction.endDate) && iterations < MAX_DUE_DATES_PER_RUN) {
      iterations += 1
      const outcome = await processDueDate(req, tenantId, instruction, dueDate, input.amountOverrides)
      outcomes.push(outcome)
      const next = advanceDate(dueDate, instruction.frequency)
      await repo.advanceNextDueDate(tenantId, instruction.id, next, dueDate)
      dueDate = next
    }
    if (instruction.endDate && dueDate > instruction.endDate) {
      await prisma.standingInstruction.updateMany({ where: { id: instruction.id, tenantId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
    }
  }

  return outcomes
}

async function processDueDate(
  req: Request,
  tenantId: string,
  instruction: StandingInstruction,
  dueDate: Date,
  amountOverrides?: Record<string, string | number>,
): Promise<GenerationOutcome> {
  const dueDateKey = dueDate.toISOString().slice(0, 10)

  const existingExecution = await prisma.standingInstructionExecution.findFirst({
    where: { standingInstructionId: instruction.id, dueDate, tenantId },
  })
  if (existingExecution) {
    return {
      standingInstructionId: instruction.id,
      dueDate: dueDateKey,
      status: existingExecution.status as GenerationOutcome['status'],
      treasuryAdjustmentId: existingExecution.treasuryAdjustmentId,
      failureReason: existingExecution.failureReason,
    }
  }

  const execution = await prisma.standingInstructionExecution.create({
    data: { tenantId, standingInstructionId: instruction.id, dueDate, status: 'PENDING' },
  })

  const override = amountOverrides?.[instruction.id]
  const amount = instruction.amountMode === 'FIXED' ? instruction.fixedAmount?.toString() : override != null ? String(override) : null

  if (!amount) {
    await prisma.standingInstructionExecution.update({
      where: { id: execution.id },
      data: { status: 'SKIPPED', failureReason: 'VARIABLE_AMOUNT_REQUIRES_MANUAL_ENTRY' },
    })
    return { standingInstructionId: instruction.id, dueDate: dueDateKey, status: 'SKIPPED', treasuryAdjustmentId: null, failureReason: 'VARIABLE_AMOUNT_REQUIRES_MANUAL_ENTRY' }
  }

  try {
    const account = await loadTreasuryAccountSnapshot(tenantId, instruction.treasuryAccountId)
    const template = instruction.lineTemplateJson as unknown as LineTemplateInput
    const adjustment = await createTreasuryAdjustmentDraft(req, tenantId, {
      legalEntityId: instruction.legalEntityId,
      branchId: instruction.branchId,
      treasuryAccountId: instruction.treasuryAccountId,
      adjustmentType: instruction.adjustmentType,
      direction: instruction.direction,
      adjustmentDate: dueDateKey,
      currencyCode: account.currencyCode,
      exchangeRate: '1',
      narration: instruction.narrationTemplate ?? `Standing instruction — ${instruction.name} (${dueDateKey})`,
      lines: [{ ...template, amount }],
    } as unknown as CreateTreasuryAdjustmentInput)

    await prisma.$transaction([
      prisma.standingInstructionExecution.update({
        where: { id: execution.id },
        data: { status: 'DRAFT_CREATED', treasuryAdjustmentId: adjustment.id, generatedAt: new Date(), generatedById: req.context?.userId ?? null },
      }),
      prisma.treasuryAdjustment.updateMany({
        where: { id: adjustment.id, tenantId },
        data: { sourceMode: 'STANDING_INSTRUCTION', standingInstructionExecutionId: execution.id },
      }),
    ])

    return { standingInstructionId: instruction.id, dueDate: dueDateKey, status: 'DRAFT_CREATED', treasuryAdjustmentId: adjustment.id, failureReason: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Draft generation failed'
    await prisma.standingInstructionExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', failureReason: message.slice(0, 500) } })
    return { standingInstructionId: instruction.id, dueDate: dueDateKey, status: 'FAILED', treasuryAdjustmentId: null, failureReason: message }
  }
}
