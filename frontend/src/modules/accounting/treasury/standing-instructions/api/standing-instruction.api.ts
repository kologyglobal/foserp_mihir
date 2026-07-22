import * as api from '@/services/api/treasuryApi'
import type {
  CancelStandingInstructionInput,
  CreateStandingInstructionInput,
  GenerateDueDraftsInput,
  GenerationOutcomeDto,
  ListStandingInstructionsQuery,
  Paginated,
  PauseStandingInstructionInput,
  ResumeStandingInstructionInput,
  StandingInstructionDto,
  UpdateStandingInstructionInput,
} from './standing-instruction.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchStandingInstructions(query: ListStandingInstructionsQuery): Promise<Paginated<StandingInstructionDto>> {
  return api.listStandingInstructions(query)
}

export async function fetchStandingInstruction(id: string): Promise<StandingInstructionDto> {
  return unwrap(await api.getStandingInstruction(id))
}

export async function createStandingInstructionDraft(data: CreateStandingInstructionInput): Promise<StandingInstructionDto> {
  return unwrap(await api.createStandingInstruction(data))
}

export async function updateStandingInstructionDraft(id: string, data: UpdateStandingInstructionInput): Promise<StandingInstructionDto> {
  return unwrap(await api.updateStandingInstruction(id, data))
}

export async function pauseStandingInstruction(id: string, data: PauseStandingInstructionInput): Promise<StandingInstructionDto> {
  return unwrap(await api.pauseStandingInstruction(id, data))
}

export async function resumeStandingInstruction(id: string, data: ResumeStandingInstructionInput): Promise<StandingInstructionDto> {
  return unwrap(await api.resumeStandingInstruction(id, data))
}

export async function cancelStandingInstruction(id: string, data: CancelStandingInstructionInput): Promise<StandingInstructionDto> {
  return unwrap(await api.cancelStandingInstruction(id, data))
}

export async function generateDueDrafts(data: GenerateDueDraftsInput): Promise<GenerationOutcomeDto[]> {
  return unwrap(await api.generateDueStandingInstructionDrafts(data))
}
