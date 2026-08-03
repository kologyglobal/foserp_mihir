import { EnterpriseKpiStrip } from '@/design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

interface HrKpiStripProps {
  items: EnterpriseKpiItem[]
  columns?: number
}

/** Thin HRMS wrapper around EnterpriseKpiStrip — keeps a single import point for future tone tweaks. */
export function HrKpiStrip({ items, columns }: HrKpiStripProps) {
  if (items.length === 0) return null
  return <EnterpriseKpiStrip items={items} columns={columns ?? (items.length >= 6 ? 6 : items.length)} />
}
