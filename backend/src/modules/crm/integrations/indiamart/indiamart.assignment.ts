import type { IndiaMartConnection, IndiaMartEnquiry } from '@prisma/client'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'
import * as repo from './indiamart.repository.js'

export async function resolveAssignee(
  connection: IndiaMartConnection,
  enquiry: Pick<IndiaMartEnquiry, 'buyerCity' | 'buyerState' | 'productName' | 'assignedUserId'>,
): Promise<string | null> {
  if (enquiry.assignedUserId) return enquiry.assignedUserId

  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  const mode = connection.assignmentMode

  if (mode === 'MANUAL') return null

  if (mode === 'TERRITORY_BASED' || mode === 'CITY_STATE_BASED') {
    const rules = (cfg.territoryRules ?? [])
      .filter((r) => r.active)
      .sort((a, b) => a.priority - b.priority)
    for (const rule of rules) {
      const hay =
        rule.conditionType === 'city'
          ? enquiry.buyerCity
          : rule.conditionType === 'state'
            ? enquiry.buyerState
            : rule.conditionType === 'product'
              ? enquiry.productName
              : connection.defaultTerritoryId
      if (hay && hay.toLowerCase().includes(rule.conditionValue.toLowerCase())) {
        return rule.assignedUserId
      }
    }
    const fallback = rules.find((r) => r.fallbackUserId)?.fallbackUserId
    if (fallback) return fallback
  }

  if (mode === 'ROUND_ROBIN') {
    const users = cfg.roundRobinUserIds ?? []
    if (users.length > 0) {
      const idx = (cfg.roundRobinCursor ?? 0) % users.length
      const chosen = users[idx]!
      await repo.upsertConnection(connection.tenantId, connection.updatedById ?? connection.createdById ?? '', {
        configurationJson: {
          ...cfg,
          roundRobinCursor: idx + 1,
        },
      })
      return chosen
    }
  }

  return connection.defaultLeadOwnerId
}
