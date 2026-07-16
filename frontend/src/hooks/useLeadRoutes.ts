import { useMemo } from 'react'

export interface LeadRoutes {
  base: string
  new: string
  view: (id: string) => string
  edit: (id: string) => string
  favoritePath: string
  /** Always false — `/sales/leads*` redirects to `/crm/leads*`. Kept for callers. */
  isSalesAlias: boolean
}

const CRM_LEADS_BASE = '/crm/leads'

/** Canonical CRM lead paths (`/sales/leads*` redirects here). */
export function useLeadRoutes(): LeadRoutes {
  return useMemo(
    () => ({
      base: CRM_LEADS_BASE,
      new: `${CRM_LEADS_BASE}/new`,
      view: (id: string) => `${CRM_LEADS_BASE}/${id}`,
      edit: (id: string) => `${CRM_LEADS_BASE}/${id}/edit`,
      favoritePath: CRM_LEADS_BASE,
      isSalesAlias: false,
    }),
    [],
  )
}
