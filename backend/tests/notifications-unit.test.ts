import { describe, expect, it } from 'vitest'
import { buildDedupKey, priorityRank } from '../src/modules/notifications/notification.constants.js'
import { businessHoursBetween, localDateKey } from '../src/modules/notifications/sla-time.js'

describe('notification constants', () => {
  it('builds stable dedup keys', () => {
    expect(buildDedupKey(['t1', 'FOLLOW_UP_OVERDUE', 'fu-1', 'u1', '2026-08-03'])).toBe(
      't1:FOLLOW_UP_OVERDUE:fu-1:u1:2026-08-03',
    )
  })

  it('ranks priorities correctly', () => {
    expect(priorityRank('CRITICAL')).toBeGreaterThan(priorityRank('HIGH'))
    expect(priorityRank('HIGH')).toBeGreaterThan(priorityRank('NORMAL'))
  })
})

describe('sla-time', () => {
  it('localDateKey uses timezone', () => {
    const d = new Date('2026-08-03T18:30:00.000Z') // 00:00 IST Aug 4
    expect(localDateKey(d, 'Asia/Kolkata')).toBe('2026-08-04')
  })

  it('counts business hours only Mon–Fri in window', () => {
    // Friday 10:00 IST to Friday 14:00 IST ≈ 4 biz hours (9–18)
    const from = new Date('2026-07-31T04:30:00.000Z') // Fri 10:00 IST
    const to = new Date('2026-07-31T08:30:00.000Z') // Fri 14:00 IST
    const hours = businessHoursBetween(from, to, {
      timeZone: 'Asia/Kolkata',
      startHour: 9,
      endHour: 18,
    })
    expect(hours).toBeGreaterThanOrEqual(3.5)
    expect(hours).toBeLessThanOrEqual(4.5)
  })
})
