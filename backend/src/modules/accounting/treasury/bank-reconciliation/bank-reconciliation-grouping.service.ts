import { toDecimal } from '../../shared/finance-decimal.js'

export interface GroupableItem {
  id: string
  amount: string
  score: number
}

export interface GroupCombination<T extends GroupableItem> {
  items: T[]
  totalAmount: string
  averageScore: number
}

/**
 * Bounded subset-sum search: find combinations of `items` (size 2..maxGroupSize) whose amounts
 * sum exactly to `targetAmount`. Search space is bounded by maxGroupSize and a hard pool cap
 * (`poolCap`) to keep this deterministic and fast for reconciliation-sized candidate pools —
 * used for both ONE_TO_MANY (line vs. multiple GL entries) and MANY_TO_ONE (multiple lines vs.
 * one GL entry) grouping.
 */
export function findExactGroupCombinations<T extends GroupableItem>(
  items: T[],
  targetAmount: string,
  maxGroupSize: number,
  poolCap = 12,
): GroupCombination<T>[] {
  const pool = items.slice(0, poolCap)
  const target = toDecimal(targetAmount)
  const results: GroupCombination<T>[] = []

  function combine(start: number, chosen: T[], sum: ReturnType<typeof toDecimal>): void {
    if (chosen.length >= 2 && sum.eq(target)) {
      results.push({
        items: [...chosen],
        totalAmount: sum.toFixed(4),
        averageScore: Math.round(chosen.reduce((acc, c) => acc + c.score, 0) / chosen.length),
      })
      return
    }
    if (chosen.length >= maxGroupSize || sum.gt(target)) return
    for (let i = start; i < pool.length; i += 1) {
      const next = sum.add(pool[i].amount)
      if (next.gt(target)) continue
      combine(i + 1, [...chosen, pool[i]], next)
    }
  }

  combine(0, [], toDecimal(0))
  results.sort((a, b) => b.averageScore - a.averageScore || a.items.length - b.items.length)
  return results
}
