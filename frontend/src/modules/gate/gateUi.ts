export const GATE_BREADCRUMB = [{ label: 'Gate & Security', to: '/gate' }] as const

export const GATE_DEPARTMENTS = [
  'Purchase',
  'Store',
  'Production',
  'Quality',
  'Dispatch',
  'Finance',
  'Maintenance',
  'Administration',
  'Sales',
  'Management',
] as const

/** Demo host directory — in API mode host lookup should move to the users API. */
export const GATE_HOSTS = [
  { name: 'Vikram Mehta', department: 'Sales' },
  { name: 'Anita Desai', department: 'Purchase' },
  { name: 'Mohammed Ismail', department: 'Purchase' },
  { name: 'Ganesh Kumar', department: 'Dispatch' },
  { name: 'Priya Raghavan', department: 'Quality' },
  { name: 'Karthik Subramani', department: 'Maintenance' },
  { name: 'Lakshmi Narayan', department: 'Administration' },
  { name: 'Ravi Shankar', department: 'Finance' },
  { name: 'Production Head', department: 'Production' },
  { name: 'Store In-charge', department: 'Store' },
] as const
