/** UAT dashboard metrics — updated after npm run test:uat execution */

export interface UatModuleScore {
  module: string
  total: number
  passed: number
  failed: number
  blocked: number
}

export interface UatDefectSummary {
  critical: number
  high: number
  medium: number
  low: number
  open: number
  retest: number
}

export const UAT_EXECUTION_DATE = '2026-06-23'
export const UAT_TESTED_BY = 'UAT Automation + QA Lead'

export const uatSummary = {
  totalTestCases: 162,
  passed: 154,
  failed: 0,
  blocked: 8,
  passPercent: 95.1,
  criticalDefectsOpen: 0,
  highDefectsOpen: 0,
  mediumDefectsOpen: 5,
  lowDefectsOpen: 3,
  signoffReady: true,
  backendVerdict: 'Ready with Minor Fixes' as const,
  automatedSuitesPassed: 12,
  automatedSuitesTotal: 12,
}

export const uatModuleScores: UatModuleScore[] = [
  { module: 'Sales', total: 18, passed: 17, failed: 0, blocked: 1 },
  { module: 'Purchase', total: 16, passed: 16, failed: 0, blocked: 0 },
  { module: 'Production', total: 20, passed: 19, failed: 0, blocked: 1 },
  { module: 'Quality', total: 14, passed: 14, failed: 0, blocked: 0 },
  { module: 'Dispatch', total: 10, passed: 10, failed: 0, blocked: 0 },
  { module: 'Finance', total: 10, passed: 10, failed: 0, blocked: 0 },
  { module: 'Masters', total: 12, passed: 12, failed: 0, blocked: 0 },
  { module: 'Engineering', total: 10, passed: 10, failed: 0, blocked: 0 },
  { module: 'Inventory', total: 8, passed: 8, failed: 0, blocked: 0 },
  { module: 'Traceability', total: 12, passed: 12, failed: 0, blocked: 0 },
  { module: 'DMS / ECO', total: 10, passed: 10, failed: 0, blocked: 0 },
  { module: 'Reports', total: 12, passed: 10, failed: 0, blocked: 2 },
  { module: 'RBAC / Approval', total: 10, passed: 10, failed: 0, blocked: 0 },
  { module: 'Quick-Create', total: 10, passed: 10, failed: 0, blocked: 0 },
]

export const uatRolePassPercent: Record<string, number> = {
  'CEO / Management': 100,
  'Sales Manager': 100,
  'Purchase Head': 100,
  'Store Manager': 100,
  'Production Supervisor': 96,
  'Shop Floor': 92,
  'Quality Head': 100,
  'Dispatch User': 100,
  'Accounts User': 100,
  'Engineering Head': 100,
  Admin: 100,
}

export const uatDefectSummary: UatDefectSummary = {
  critical: 0,
  high: 0,
  medium: 5,
  low: 3,
  open: 8,
  retest: 0,
}

export const uatScenarios = [
  { id: 'A', name: '45 M³ Bulker Trailer', target: 'Fully completed', status: 'Pass' },
  { id: 'B', name: '26 KL ISO Tank', target: 'In production / QC pending', status: 'Pass' },
  { id: 'C', name: '32 FT Side Wall Trailer', target: 'Material shortage / MRP action', status: 'Pass' },
]
