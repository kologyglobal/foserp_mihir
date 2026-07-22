/** Finance Phase 5B3 — Standing instruction API types (draft-only recurring generation). */
import type { LineTemplateInput, TreasuryAdjustmentDirection, TreasuryAdjustmentType } from '../../adjustments/api/treasury-adjustment.types'

export type StandingInstructionFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY'
export type StandingInstructionAmountMode = 'FIXED' | 'VARIABLE'
export type StandingInstructionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED'

export interface StandingInstructionDto {
  id: string
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  name: string
  description?: string | null
  status: StandingInstructionStatus
  adjustmentType: TreasuryAdjustmentType
  direction: TreasuryAdjustmentDirection
  frequency: StandingInstructionFrequency
  amountMode: StandingInstructionAmountMode
  fixedAmount?: string | null
  startDate: string
  endDate?: string | null
  nextDueDate: string
  lineTemplateJson: LineTemplateInput
  narrationTemplate?: string | null
  lastGeneratedAt?: string | null
  lastGeneratedForDate?: string | null
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListStandingInstructionsQuery {
  legalEntityId: string
  status?: StandingInstructionStatus
  treasuryAccountId?: string
  page?: number
  limit?: number
}

export interface CreateStandingInstructionInput {
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  name: string
  description?: string | null
  adjustmentType: TreasuryAdjustmentType
  direction: TreasuryAdjustmentDirection
  frequency: StandingInstructionFrequency
  amountMode: StandingInstructionAmountMode
  fixedAmount?: string | number | null
  startDate: string
  endDate?: string | null
  lineTemplate: LineTemplateInput
  narrationTemplate?: string | null
}

export interface UpdateStandingInstructionInput extends CreateStandingInstructionInput {
  expectedUpdatedAt: string
}

export interface PauseStandingInstructionInput {
  expectedUpdatedAt: string
}
export interface ResumeStandingInstructionInput {
  expectedUpdatedAt: string
}
export interface CancelStandingInstructionInput {
  expectedUpdatedAt: string
  reason: string
}

export interface GenerateDueDraftsInput {
  legalEntityId: string
  asOfDate?: string
  standingInstructionId?: string
  amountOverrides?: Record<string, string | number>
}

export interface GenerationOutcomeDto {
  standingInstructionId: string
  dueDate: string
  status: 'DRAFT_CREATED' | 'SKIPPED' | 'FAILED'
  treasuryAdjustmentId: string | null
  failureReason: string | null
}
