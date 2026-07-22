import { getShopfloorLive } from '../shopfloor/shopfloor.service.js'
import type { ExecutorContext, ExecutorOutput } from '../types.js'

export async function executeShopfloorLive(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const filters = ctx.filters as { plantCode?: string; workCentreId?: string }
  const data = await getShopfloorLive(ctx.tenantId, filters)
  return {
    rows: data.rows,
    summary: {
      activeStageCount: data.rows.length,
      lastRefreshed: data.lastRefreshed,
      suggestedRefreshSeconds: data.suggestedRefreshSeconds,
    },
    dataFreshness: data.lastRefreshed,
    warnings: [],
  }
}
