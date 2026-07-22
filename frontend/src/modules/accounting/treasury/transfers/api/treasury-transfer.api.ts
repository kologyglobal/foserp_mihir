import * as api from '@/services/api/treasuryApi'
import type {
  CreateTransferInput,
  DeleteTransferInput,
  LifecycleInput,
  ListTransfersQuery,
  Paginated,
  ReasonedLifecycleInput,
  ReverseTransferInput,
  TransferReversalPreviewDto,
  TreasuryTransferDto,
  UpdateTransferInput,
} from './treasury-transfer.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchTransfers(query: ListTransfersQuery): Promise<Paginated<TreasuryTransferDto>> {
  return api.listTreasuryTransfers(query)
}

export async function fetchTransfer(id: string): Promise<TreasuryTransferDto> {
  return unwrap(await api.getTreasuryTransfer(id))
}

export async function createTransferDraft(data: CreateTransferInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.createTreasuryTransfer(data))
}

export async function updateTransferDraft(id: string, data: UpdateTransferInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.updateTreasuryTransfer(id, data))
}

export async function deleteTransferDraft(id: string, data: DeleteTransferInput): Promise<void> {
  await api.deleteTreasuryTransfer(id, data)
}

export async function validateTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.validateTreasuryTransfer(id, data))
}

export async function submitTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.submitTreasuryTransfer(id, data))
}

export async function approveTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.approveTreasuryTransfer(id, data))
}

export async function rejectTransfer(id: string, data: ReasonedLifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.rejectTreasuryTransfer(id, data))
}

export async function reviseTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.reviseTreasuryTransfer(id, data))
}

export async function markTransferReady(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.markTreasuryTransferReady(id, data))
}

export async function cancelTransfer(id: string, data: ReasonedLifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.cancelTreasuryTransfer(id, data))
}

export async function postTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.postTreasuryTransfer(id, data))
}

export async function dispatchTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.dispatchTreasuryTransfer(id, data))
}

export async function receiveTransfer(id: string, data: LifecycleInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.receiveTreasuryTransfer(id, data))
}

export async function reverseTransfer(id: string, data: ReverseTransferInput): Promise<TreasuryTransferDto> {
  return unwrap(await api.reverseTreasuryTransfer(id, data))
}

export async function fetchTransferReversalPreview(id: string): Promise<TransferReversalPreviewDto> {
  return unwrap(await api.getTreasuryTransferReversalPreview(id))
}
