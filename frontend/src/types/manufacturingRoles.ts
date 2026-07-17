/**
 * Manufacturing UI role planning (demo / placeholder).
 * Not backend RBAC — used only to gate FE actions and show role badges.
 */

export const MANUFACTURING_UI_ROLES = [
  'owner',
  'production_manager',
  'supervisor',
  'store_user',
  'qc_user',
  'job_work_user',
  'viewer',
] as const

export type ManufacturingUiRole = (typeof MANUFACTURING_UI_ROLES)[number]

export const MANUFACTURING_UI_ROLE_LABELS: Record<ManufacturingUiRole, string> = {
  owner: 'Owner / Management',
  production_manager: 'Production Manager',
  supervisor: 'Supervisor',
  store_user: 'Store User',
  qc_user: 'QC User',
  job_work_user: 'Job Work User',
  viewer: 'Viewer',
}

export const MANUFACTURING_UI_ROLE_SHORT: Record<ManufacturingUiRole, string> = {
  owner: 'Owner',
  production_manager: 'Prod Mgr',
  supervisor: 'Supervisor',
  store_user: 'Store',
  qc_user: 'QC',
  job_work_user: 'Job Work',
  viewer: 'Viewer',
}

export const MANUFACTURING_UI_ROLE_DESCRIPTIONS: Record<ManufacturingUiRole, string> = {
  owner: 'Dashboard, reports, all work orders, and production performance (read-focused).',
  production_manager: 'Create plans and WOs; start, hold, complete, and close work orders.',
  supervisor: 'Start, hold, resume, and complete production on the shopfloor.',
  store_user: 'View material requirements; reserve and issue material.',
  qc_user: 'View QC-pending WOs; accept, reject, or send to rework.',
  job_work_user: 'Create job work; send / receive material; reconcile.',
  viewer: 'Read-only access across manufacturing screens.',
}

/** Tone for role badge chips. */
export const MANUFACTURING_UI_ROLE_TONE: Record<ManufacturingUiRole, string> = {
  owner: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  production_manager: 'bg-sky-50 text-sky-900 ring-sky-200',
  supervisor: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  store_user: 'bg-amber-50 text-amber-900 ring-amber-200',
  qc_user: 'bg-violet-50 text-violet-900 ring-violet-200',
  job_work_user: 'bg-teal-50 text-teal-900 ring-teal-200',
  viewer: 'bg-slate-100 text-slate-700 ring-slate-200',
}
