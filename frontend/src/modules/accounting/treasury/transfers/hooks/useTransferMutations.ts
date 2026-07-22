import { useCallback, useState } from 'react'
import { notify } from '@/store/toastStore'
import {
  approveTransfer,
  cancelTransfer,
  deleteTransferDraft,
  markTransferReady,
  postTransfer,
  rejectTransfer,
  reviseTransfer,
  submitTransfer,
  validateTransfer,
} from '../api/treasury-transfer.api'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'
import { useIdempotencyKey } from '../utils/idempotency'

/** Wraps the simple (non-modal) lifecycle actions with idempotency + toast feedback. */
export function useTransferMutations(transfer: TreasuryTransferDto | null, onUpdated: (updated: TreasuryTransferDto) => void) {
  const [busy, setBusy] = useState(false)
  const getKey = useIdempotencyKey(transfer ? `${transfer.id}-${transfer.updatedAt}` : 'none')

  const run = useCallback(
    async (label: string, action: () => Promise<TreasuryTransferDto>) => {
      setBusy(true)
      try {
        const updated = await action()
        notify.success(label)
        onUpdated(updated)
        return updated
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
        throw e
      } finally {
        setBusy(false)
      }
    },
    [onUpdated],
  )

  const validate = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Validation completed', () => validateTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }))
  }, [transfer, run, getKey])

  const submit = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Submitted for approval', () => submitTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }))
  }, [transfer, run, getKey])

  const approve = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Transfer approved', () => approveTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }))
  }, [transfer, run, getKey])

  const reject = useCallback(
    (reason: string) => {
      if (!transfer) return Promise.reject(new Error('No transfer'))
      return run('Transfer rejected', () => rejectTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, reason, idempotencyKey: getKey() }))
    },
    [transfer, run, getKey],
  )

  const revise = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Transfer returned to draft for revision', () =>
      reviseTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }),
    )
  }, [transfer, run, getKey])

  const markReady = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Marked ready to post', () => markTransferReady(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }))
  }, [transfer, run, getKey])

  const cancel = useCallback(
    (reason: string) => {
      if (!transfer) return Promise.reject(new Error('No transfer'))
      return run('Transfer cancelled', () => cancelTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, reason, idempotencyKey: getKey() }))
    },
    [transfer, run, getKey],
  )

  const post = useCallback(() => {
    if (!transfer) return Promise.reject(new Error('No transfer'))
    return run('Transfer posted', () => postTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() }))
  }, [transfer, run, getKey])

  const remove = useCallback(async () => {
    if (!transfer) return
    setBusy(true)
    try {
      await deleteTransferDraft(transfer.id, { expectedUpdatedAt: transfer.updatedAt })
      notify.success('Draft transfer deleted')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
      throw e
    } finally {
      setBusy(false)
    }
  }, [transfer])

  return { busy, validate, submit, approve, reject, revise, markReady, cancel, post, remove }
}
