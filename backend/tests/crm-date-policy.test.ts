import { describe, expect, it } from 'vitest'
import {
  assertFollowUpInFuture,
  combineFollowUpUtc,
  isFutureDateTime,
  validateFollowUpAt,
} from '../src/utils/crmDatePolicy.js'
import { ValidationError } from '../src/utils/errors.js'

describe('crmDatePolicy — follow-up date/time', () => {
  const now = new Date('2026-07-17T12:00:00.000Z')

  it('isFutureDateTime accepts near-future ISO', () => {
    expect(isFutureDateTime('2026-07-17T12:01:00.000Z', now)).toBe(true)
    expect(isFutureDateTime(new Date('2026-07-18T00:00:00.000Z'), now)).toBe(true)
  })

  it('isFutureDateTime rejects past and equal timestamps', () => {
    expect(isFutureDateTime('2026-07-17T11:59:00.000Z', now)).toBe(false)
    expect(isFutureDateTime(now, now)).toBe(false)
    expect(isFutureDateTime(null, now)).toBe(false)
    expect(isFutureDateTime('not-a-date', now)).toBe(false)
  })

  it('validateFollowUpAt rejects past dueDate+dueTime (UTC wall-clock)', () => {
    expect(validateFollowUpAt({ dueDate: '2026-07-17', dueTime: '11:00' }, now)).toBe(
      'Follow-up date/time must be in the future',
    )
    expect(validateFollowUpAt({ dueDate: '2026-07-16', dueTime: '18:00' }, now)).toBe(
      'Follow-up date/time must be in the future',
    )
  })

  it('validateFollowUpAt accepts near-future dueDate+dueTime', () => {
    expect(validateFollowUpAt({ dueDate: '2026-07-17', dueTime: '12:01' }, now)).toBeNull()
    expect(validateFollowUpAt({ dueDate: '2026-07-18', dueTime: '09:00' }, now)).toBeNull()
  })

  it('validateFollowUpAt rejects invalid calendar / empty', () => {
    expect(validateFollowUpAt({ dueDate: '2026-13-40', dueTime: '10:00' }, now)).toBe(
      'Enter a valid follow-up date and time',
    )
    expect(validateFollowUpAt(null, now)).toBe('Follow-up date/time is required')
    expect(validateFollowUpAt({ dueDate: '', dueTime: '10:00' }, now)).toBe(
      'Follow-up date is required',
    )
  })

  it('combineFollowUpUtc builds UTC instant', () => {
    const dt = combineFollowUpUtc('2026-07-17', '14:30')
    expect(dt?.toISOString()).toBe('2026-07-17T14:30:00.000Z')
  })

  it('assertFollowUpInFuture throws ValidationError for past', () => {
    expect(() => assertFollowUpInFuture('2026-07-17', '10:00', now)).toThrow(ValidationError)
    try {
      assertFollowUpInFuture('2026-07-17', '10:00', now)
    } catch (e) {
      const err = e as ValidationError
      expect(err.statusCode).toBe(400)
      expect(err.message).toBe('Follow-up date/time must be in the future')
      expect(err.errors?.[0]?.field).toBe('dueDate')
    }
  })

  it('assertFollowUpInFuture accepts near-future', () => {
    expect(() => assertFollowUpInFuture('2026-07-17', '12:30', now)).not.toThrow()
  })
})
