/** Canonical Control Tower route builders */

export const CONTROL_TOWER_ROUTES = {
  executive: '/executive',
  /** Simple Manufacturing dashboard (legacy Control Tower redirects here). */
  production: '/manufacturing',
  mrpPlanner: '/mrp/planner',
  inbox: '/inbox',
} as const

export function wo360Path(woId: string) {
  return `/manufacturing/work-orders/${woId}`
}

export function item360Path(itemId: string) {
  return `/masters/items/${itemId}`
}

export function vendor360Path(vendorId: string) {
  return `/masters/vendors/${vendorId}`
}
