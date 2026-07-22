import type { Request } from 'express'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { loadTreasuryAccountSnapshot } from '../adjustments/treasury-adjustment-account-resolver.service.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import * as repo from './standing-instruction.repository.js'
import { StandingInstructionInvalidStatusError, StandingInstructionValidationFailedError } from './standing-instruction.errors.js'
import type {
  CancelStandingInstructionInput,
  CreateStandingInstructionInput,
  ListStandingInstructionsQuery,
  PauseStandingInstructionInput,
  ResumeStandingInstructionInput,
  UpdateStandingInstructionInput,
} from './standing-instruction.schemas.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({ tenantId, userId: meta.userId, module: 'finance', entity: 'standing_instruction', entityId: id, action, newValues, ipAddress: meta.ipAddress, userAgent: meta.userAgent })
}

async function assertOwnership(tenantId: string, legalEntityId: string, branchId?: string | null, treasuryAccountId?: string): Promise<void> {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const branchCheck = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (branchCheck.errors.length > 0) {
    throw new StandingInstructionValidationFailedError(branchCheck.errors[0]?.message ?? 'Invalid branch', branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })))
  }
  if (treasuryAccountId) await loadTreasuryAccountSnapshot(tenantId, treasuryAccountId)
}

export async function createStandingInstruction(req: Request, tenantId: string, input: CreateStandingInstructionInput) {
  await assertOwnership(tenantId, input.legalEntityId, input.branchId, input.treasuryAccountId)
  const row = await repo.create(tenantId, input, req.context?.userId)
  await audit(req, tenantId, row.id, 'STANDING_INSTRUCTION_CREATED', { name: row.name })
  return row
}

export async function updateStandingInstruction(req: Request, tenantId: string, id: string, input: UpdateStandingInstructionInput) {
  await assertOwnership(tenantId, input.legalEntityId, input.branchId, input.treasuryAccountId)
  const row = await repo.update(tenantId, id, input, req.context?.userId)
  await audit(req, tenantId, id, 'STANDING_INSTRUCTION_UPDATED')
  return row
}

export async function getStandingInstruction(_req: Request, tenantId: string, id: string) {
  return repo.findByIdOrThrow(tenantId, id)
}

export async function listStandingInstructions(_req: Request, tenantId: string, query: ListStandingInstructionsQuery) {
  return repo.list(tenantId, query)
}

export async function pauseStandingInstruction(req: Request, tenantId: string, id: string, input: PauseStandingInstructionInput) {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'ACTIVE') throw new StandingInstructionInvalidStatusError('Only active standing instructions can be paused')
  repo.assertExpectedUpdatedAt(existing, input.expectedUpdatedAt)
  const row = await repo.setStatus(tenantId, id, 'PAUSED', req.context?.userId)
  await audit(req, tenantId, id, 'STANDING_INSTRUCTION_PAUSED')
  return row
}

export async function resumeStandingInstruction(req: Request, tenantId: string, id: string, input: ResumeStandingInstructionInput) {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'PAUSED') throw new StandingInstructionInvalidStatusError('Only paused standing instructions can be resumed')
  repo.assertExpectedUpdatedAt(existing, input.expectedUpdatedAt)
  const row = await repo.setStatus(tenantId, id, 'ACTIVE', req.context?.userId)
  await audit(req, tenantId, id, 'STANDING_INSTRUCTION_RESUMED')
  return row
}

export async function cancelStandingInstruction(req: Request, tenantId: string, id: string, input: CancelStandingInstructionInput) {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (!['ACTIVE', 'PAUSED'].includes(existing.status)) throw new StandingInstructionInvalidStatusError('Standing instruction cannot be cancelled in its current status')
  repo.assertExpectedUpdatedAt(existing, input.expectedUpdatedAt)
  const row = await repo.setStatus(tenantId, id, 'CANCELLED', req.context?.userId)
  await audit(req, tenantId, id, 'STANDING_INSTRUCTION_CANCELLED', { reason: input.reason })
  return row
}
