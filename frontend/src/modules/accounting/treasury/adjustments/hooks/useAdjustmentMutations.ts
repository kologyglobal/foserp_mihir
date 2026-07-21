import { useCallback, useState } from 'react'
import { notify } from '@/store/toastStore'
import {
  approveAdjustment,
  cancelAdjustment,
  fetchAdjustment,
  markAdjustmentReady,
  postAdjustment,
  rejectAdjustment,
  reverseAdjustment,
  reviseAdjustment,
  submitAdjustment,
  validateAdjustment,
} from '../api/treasury-adjustment.api'
import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'
import { useIdempotencyKey } from '../utils/idempotency'

/** Wraps treasury adjustment lifecycle actions with idempotency + toast feedback. */
export function useAdjustmentMutations(
  adjustment: TreasuryAdjustmentDto | null,
  onUpdated: (updated: TreasuryAdjustmentDto) => void,
) {
  const [busy, setBusy] = useState(false)
  const getKey = useIdempotencyKey(adjustment ? `${adjustment.id}-${adjustment.updatedAt}` : 'none')

  const run = useCallback(
    async (label: string, action: () => Promise<TreasuryAdjustmentDto>) => {
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
    if (!adjustment) return Promise.reject(new Error('No adjustment'))
    return run('Validation completed', async () => {
      await validateAdjustment(adjustment.id)
      return fetchAdjustment(adjustment.id)
    })
  }, [adjustment, run])

  const submit = useCallback(() => {
    if (!adjustment) return Promise.reject(new Error('No adjustment'))
    return run('Submitted for approval', () =>
      submitAdjustment(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, idempotencyKey: getKey() }),
    )
  }, [adjustment, run, getKey])

  const approve = useCallback(() => {
    if (!adjustment) return Promise.reject(new Error('No adjustment'))
    return run('Adjustment approved', () =>
      approveAdjustment(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, idempotencyKey: getKey() }),
    )
  }, [adjustment, run, getKey])

  const reject = useCallback(
    (reason: string) => {
      if (!adjustment) return Promise.reject(new Error('No adjustment'))
      return run('Adjustment rejected', () =>
        rejectAdjustment(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, reason, idempotencyKey: getKey() }),
      )
    },
    [adjustment, run, getKey],
  )

  const revise = useCallback(() => {
    if (!adjustment) return Promise.reject(new Error('No adjustment'))
    return run('Adjustment returned to draft for revision', () =>
      reviseAdjustment(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, idempotencyKey: getKey() }),
    )
  }, [adjustment, run, getKey])

  const markReady = useCallback(() => {
    if (!adjustment) return Promise.reject(new Error('No adjustment'))
    return run('Marked ready to post', () =>
      markAdjustmentReady(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, idempotencyKey: getKey() }),
    )
  }, [adjustment, run, getKey])

  const cancel = useCallback(
    (reason: string) => {
      if (!adjustment) return Promise.reject(new Error('No adjustment'))
      return run('Adjustment cancelled', () =>
        cancelAdjustment(adjustment.id, { expectedUpdatedAt: adjustment.updatedAt, reason, idempotencyKey: getKey() }),
      )
    },
    [adjustment, run, getKey],
  )

  const post = useCallback(
    (postingDate?: string) => {
      if (!adjustment) return Promise.reject(new Error('No adjustment'))
      return run('Adjustment posted', async () => {
        const result = await postAdjustment(adjustment.id, {
          expectedUpdatedAt: adjustment.updatedAt,
          postingDate,
          idempotencyKey: getKey(),
        })
        return result.adjustment
      })
    },
    [adjustment, run, getKey],
  )

  const reverse = useCallback(
    (reversalDate: string, reason: string) => {
      if (!adjustment) return Promise.reject(new Error('No adjustment'))
      return run('Adjustment reversed', async () => {
        const result = await reverseAdjustment(adjustment.id, {
          expectedUpdatedAt: adjustment.updatedAt,
          reversalDate,
          reason,
          idempotencyKey: getKey(),
        })
        return result.adjustment
      })
    },
    [adjustment, run, getKey],
  )

  return { busy, validate, submit, approve, reject, revise, markReady, cancel, post, reverse }
}
