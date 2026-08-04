/**
 * Live Inventory Store Workbench API — queues over existing engines (no duplicate stock tables).
 * Base: /api/v1/t/:tenantSlug/inventory/store-workbench
 */
import { apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const base = () => tenantPath('/inventory/store-workbench')

export type StoreNeedsActionSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type StoreNeedsActionDomain =
  | 'manufacturing'
  | 'purchase'
  | 'dispatch'
  | 'transfers'
  | 'stock-counts'
  | 'adjustments'
  | 'reconciliation'
  | 'exceptions'

export interface StoreNeedsActionRow {
  key: string
  domain: StoreNeedsActionDomain
  category: string
  severity: StoreNeedsActionSeverity
  title: string
  detail: string
  source: { type: string; id: string; number?: string | null }
  deepLink: string | null
  quantity: string | null
  asOf: string
}

export interface InventoryStoreWorkbenchSummary {
  asOf: string
  needsAction: {
    total: number
    byDomain: Record<string, number>
    bySeverity: Record<StoreNeedsActionSeverity, number>
  }
  manufacturing: {
    asOf?: string
    openWorkOrders?: number
    kpis: {
      waitingReservation: number
      waitingIssue: number
      waitingReturns: number
      waitingWip: number
      waitingFg: number
      activeWoReservations: number
    }
  }
}

export async function getInventoryStoreWorkbenchSummary() {
  return apiRequest<InventoryStoreWorkbenchSummary>(`${base()}/summary`)
}

export async function listInventoryStoreNeedsAction(params?: { limit?: number }) {
  return apiRequest<{ asOf: string; rows: StoreNeedsActionRow[] }>(
    `${base()}/needs-action${buildQuery(params)}`,
  )
}

export async function listInventoryStoreNeedsActionDomain(
  domain: StoreNeedsActionDomain,
  params?: { limit?: number },
) {
  return apiRequest<{ asOf: string; domain: string; rows: StoreNeedsActionRow[] }>(
    `${base()}/needs-action/${domain}${buildQuery(params)}`,
  )
}
