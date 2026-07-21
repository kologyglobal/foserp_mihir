import { useCallback, useState } from 'react'
import { notify } from '@/store/toastStore'
import {
  approveCheque,
  bounceCheque,
  cancelCheque,
  clearCheque,
  depositCheque,
  fetchCheque,
  issueCheque,
  markChequeReady,
  rejectCheque,
  reverseCheque,
  reviseCheque,
  stopCheque,
  submitCheque,
  validateCheque,
} from '../api/treasury-cheque.api'
import type { TreasuryChequeDto } from '../api/treasury-cheque.types'
import { useIdempotencyKey } from '../utils/idempotency'

/** Wraps cheque lifecycle actions with idempotency + toast feedback — mirrors treasury transfer mutations. */
export function useChequeMutations(cheque: TreasuryChequeDto | null, onUpdated: (updated: TreasuryChequeDto) => void) {
  const [busy, setBusy] = useState(false)
  const getKey = useIdempotencyKey(cheque ? `${cheque.id}-${cheque.updatedAt}` : 'none')

  const run = useCallback(
    async (label: string, action: () => Promise<TreasuryChequeDto>) => {
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
    if (!cheque) return Promise.reject(new Error('No cheque'))
    return run('Validation completed', async () => {
      await validateCheque(cheque.id)
      return fetchCheque(cheque.id)
    })
  }, [cheque, run])

  const submit = useCallback(() => {
    if (!cheque) return Promise.reject(new Error('No cheque'))
    return run('Submitted for approval', () => submitCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, idempotencyKey: getKey() }))
  }, [cheque, run, getKey])

  const approve = useCallback(() => {
    if (!cheque) return Promise.reject(new Error('No cheque'))
    return run('Cheque approved', () => approveCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, idempotencyKey: getKey() }))
  }, [cheque, run, getKey])

  const reject = useCallback(
    (reason: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque rejected', () => rejectCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, reason, idempotencyKey: getKey() }))
    },
    [cheque, run, getKey],
  )

  const revise = useCallback(() => {
    if (!cheque) return Promise.reject(new Error('No cheque'))
    return run('Cheque returned to draft for revision', () =>
      reviseCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, idempotencyKey: getKey() }),
    )
  }, [cheque, run, getKey])

  const markReady = useCallback(() => {
    if (!cheque) return Promise.reject(new Error('No cheque'))
    return run('Marked ready to post', () => markChequeReady(cheque.id, { expectedUpdatedAt: cheque.updatedAt, idempotencyKey: getKey() }))
  }, [cheque, run, getKey])

  const cancel = useCallback(
    (reason: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque cancelled', () => cancelCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, reason, idempotencyKey: getKey() }))
    },
    [cheque, run, getKey],
  )

  const issue = useCallback(
    (issueDate?: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque issued', () => issueCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, issueDate, idempotencyKey: getKey() }))
    },
    [cheque, run, getKey],
  )

  const deposit = useCallback(
    (depositDate: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque deposited', () => depositCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, depositDate, idempotencyKey: getKey() }))
    },
    [cheque, run, getKey],
  )

  const clear = useCallback(
    (clearanceDate: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque marked cleared', () =>
        clearCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, clearanceDate, idempotencyKey: getKey() }),
      )
    },
    [cheque, run, getKey],
  )

  const bounce = useCallback(
    (bounceDate: string, bounceReason: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque marked bounced', () =>
        bounceCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, bounceDate, bounceReason, idempotencyKey: getKey() }),
      )
    },
    [cheque, run, getKey],
  )

  const stop = useCallback(
    (stopReason: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Stop payment recorded', () =>
        stopCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, stopReason, idempotencyKey: getKey() }),
      )
    },
    [cheque, run, getKey],
  )

  const reverse = useCallback(
    (reversalDate: string, reason: string) => {
      if (!cheque) return Promise.reject(new Error('No cheque'))
      return run('Cheque reversed', () =>
        reverseCheque(cheque.id, { expectedUpdatedAt: cheque.updatedAt, reversalDate, reason, idempotencyKey: getKey() }),
      )
    },
    [cheque, run, getKey],
  )

  return { busy, validate, submit, approve, reject, revise, markReady, cancel, issue, deposit, clear, bounce, stop, reverse }
}
