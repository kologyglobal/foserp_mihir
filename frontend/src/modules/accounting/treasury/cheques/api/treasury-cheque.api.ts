import * as api from '@/services/api/treasuryApi'
import type {
  ApproveChequeInput,
  BounceChequeInput,
  CancelChequeInput,
  ClearChequeInput,
  CreateChequeInput,
  DepositChequeInput,
  IssueChequeInput,
  ListChequesQuery,
  MarkChequeReadyInput,
  Paginated,
  RejectChequeInput,
  ReverseChequeInput,
  ReviseChequeInput,
  StopChequeInput,
  SubmitChequeInput,
  TreasuryChequeDto,
  UpdateChequeInput,
  ValidateChequeResult,
} from './treasury-cheque.types'

function unwrapCheque(res: { data: { cheque: TreasuryChequeDto } }): TreasuryChequeDto {
  return res.data.cheque
}

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchCheques(query: ListChequesQuery): Promise<Paginated<TreasuryChequeDto>> {
  return api.listTreasuryCheques(query)
}

export async function fetchCheque(id: string): Promise<TreasuryChequeDto> {
  return unwrap(await api.getTreasuryCheque(id))
}

export async function createChequeDraft(data: CreateChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.createTreasuryCheque(data))
}

export async function updateChequeDraft(id: string, data: UpdateChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.updateTreasuryCheque(id, data))
}

export async function validateCheque(id: string): Promise<ValidateChequeResult> {
  return unwrap(await api.validateTreasuryCheque(id))
}

export async function submitCheque(id: string, data: SubmitChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.submitTreasuryCheque(id, data))
}

export async function approveCheque(id: string, data: ApproveChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.approveTreasuryCheque(id, data))
}

export async function rejectCheque(id: string, data: RejectChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.rejectTreasuryCheque(id, data))
}

export async function reviseCheque(id: string, data: ReviseChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.reviseTreasuryCheque(id, data))
}

export async function markChequeReady(id: string, data: MarkChequeReadyInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.markTreasuryChequeReady(id, data))
}

export async function cancelCheque(id: string, data: CancelChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.cancelTreasuryCheque(id, data))
}

export async function issueCheque(id: string, data: IssueChequeInput): Promise<TreasuryChequeDto> {
  return unwrapCheque(await api.issueTreasuryCheque(id, data))
}

export async function depositCheque(id: string, data: DepositChequeInput): Promise<TreasuryChequeDto> {
  return unwrapCheque(await api.depositTreasuryCheque(id, data))
}

export async function clearCheque(id: string, data: ClearChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.clearTreasuryCheque(id, data))
}

export async function bounceCheque(id: string, data: BounceChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.bounceTreasuryCheque(id, data))
}

export async function stopCheque(id: string, data: StopChequeInput): Promise<TreasuryChequeDto> {
  return unwrap(await api.stopTreasuryCheque(id, data))
}

export async function reverseCheque(id: string, data: ReverseChequeInput): Promise<TreasuryChequeDto> {
  return unwrapCheque(await api.reverseTreasuryCheque(id, data))
}
