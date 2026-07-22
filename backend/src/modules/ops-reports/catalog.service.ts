import { REPORT_DEFINITIONS } from './registry.js'

export interface ReportCatalogEntry {
  key: string
  name: string
  module: string
  description: string
  filters: string[]
  defaultColumns: string[]
  exportSupported: boolean
  dateBasis: string
  calculationNotes: string
  availability: string
  unavailableReason?: string
  disabled: boolean
}

function hasPermission(userPerms: string[], permission: string): boolean {
  return userPerms.includes('tenant.manage') || userPerms.includes(permission)
}

/** Lists the report catalog filtered to reports the caller has permission for. UNAVAILABLE reports are shown with `disabled: true` rather than hidden, so the UI can explain why. */
export function listReportCatalog(userPerms: string[]): ReportCatalogEntry[] {
  return REPORT_DEFINITIONS.filter((def) => hasPermission(userPerms, def.permission)).map((def) => ({
    key: def.key,
    name: def.name,
    module: def.module,
    description: def.description,
    filters: def.filters,
    defaultColumns: def.defaultColumns,
    exportSupported: def.exportSupported,
    dateBasis: def.dateBasis,
    calculationNotes: def.calculationNotes,
    availability: def.availability,
    unavailableReason: def.unavailableReason,
    disabled: def.availability === 'UNAVAILABLE',
  }))
}
