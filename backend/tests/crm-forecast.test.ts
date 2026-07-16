import { describe, expect, it } from 'vitest'
import {
  aggregateSalesForecast,
  weightedForecastTotal,
  type ForecastInputRow,
} from '../src/modules/crm/forecast/forecast.aggregate.js'

function row(partial: Partial<ForecastInputRow> & Pick<ForecastInputRow, 'id' | 'amount' | 'probability'>): ForecastInputRow {
  return {
    name: partial.name ?? `Opp ${partial.id}`,
    expectedCloseDate: partial.expectedCloseDate ?? null,
    ownerId: partial.ownerId ?? null,
    ownerName: partial.ownerName ?? 'Unassigned',
    stageId: partial.stageId ?? 'stage-a',
    stageSlug: partial.stageSlug ?? 'negotiation',
    stageLabel: partial.stageLabel ?? 'Negotiation',
    ...partial,
  }
}

describe('crm sales forecast aggregation', () => {
  it('weighted forecast = sum(amount * probability / 100)', () => {
    const rows = [
      { amount: 1_000_000, probability: 50 },
      { amount: 500_000, probability: 20 },
      { amount: 200_000, probability: 0 },
    ]
    // 500_000 + 100_000 + 0
    expect(weightedForecastTotal(rows)).toBe(600_000)
  })

  it('rolls up totals, buckets, and at-risk using stage probabilities', () => {
    const now = new Date('2026-07-14T12:00:00.000Z')
    const snap = aggregateSalesForecast(
      [
        row({
          id: '1',
          amount: 1_000_000,
          probability: 40,
          expectedCloseDate: '2026-07-20',
          ownerId: 'u1',
          ownerName: 'Ada Admin',
          stageId: 's1',
          stageSlug: 'quotation_sent',
          stageLabel: 'Quotation Sent',
        }),
        row({
          id: '2',
          amount: 500_000,
          probability: 10,
          expectedCloseDate: '2026-06-01',
          ownerId: 'u1',
          ownerName: 'Ada Admin',
          stageId: 's2',
          stageSlug: 'qualified',
          stageLabel: 'Qualified',
        }),
        row({
          id: '3',
          amount: 250_000,
          probability: 80,
          expectedCloseDate: null,
          ownerId: null,
          ownerName: 'Unassigned',
          stageId: 's1',
          stageSlug: 'quotation_sent',
          stageLabel: 'Quotation Sent',
        }),
      ],
      now,
    )

    expect(snap.openCount).toBe(3)
    expect(snap.pipelineValue).toBe(1_750_000)
    expect(snap.weightedForecast).toBe(1_000_000 * 0.4 + 500_000 * 0.1 + 250_000 * 0.8)
    expect(snap.avgProbability).toBe(Math.round((40 + 10 + 80) / 3))
    expect(snap.closingThisMonth).toBe(1)
    expect(snap.closingThisQuarter).toBe(1)

    expect(snap.byMonth.find((m) => m.month === '2026-07')?.weighted).toBe(400_000)
    expect(snap.byMonth.find((m) => m.month === 'unscheduled')?.count).toBe(1)

    const ownerAda = snap.byOwner.find((o) => o.ownerId === 'u1')
    expect(ownerAda?.count).toBe(2)
    expect(ownerAda?.weighted).toBe(400_000 + 50_000)

    const stageQuo = snap.byStage.find((s) => s.stage === 'quotation_sent')
    expect(stageQuo?.label).toBe('Quotation Sent')
    expect(stageQuo?.count).toBe(2)
    expect(stageQuo?.pipeline).toBe(1_250_000)

    // at-risk: overdue (#2), unscheduled (#3), low probability (#2 again) — top 12 sorted by prob
    const atRiskIds = snap.atRisk.map((a) => a.id)
    expect(atRiskIds).toContain('2')
    expect(atRiskIds).toContain('3')
    expect(atRiskIds).not.toContain('1')
  })
})
