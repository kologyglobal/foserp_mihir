import type { QcChecklistItem } from '../../types/qc'

export const WELDING_QC_CHECKLIST: QcChecklistItem[] = [
  { id: 'qc-weld-pen', label: 'Weld penetration', sortOrder: 1 },
  { id: 'qc-joint-insp', label: 'Joint inspection', sortOrder: 2 },
  { id: 'qc-leak-test', label: 'Leak test', sortOrder: 3 },
]

export const CUTTING_QC_CHECKLIST: QcChecklistItem[] = [
  { id: 'qc-dim', label: 'Dimensional accuracy', sortOrder: 1 },
  { id: 'qc-edge', label: 'Edge finish', sortOrder: 2 },
]

export const TESTING_QC_CHECKLIST: QcChecklistItem[] = [
  { id: 'qc-hydro', label: 'Hydro test', sortOrder: 1 },
  { id: 'qc-road', label: 'Road test', sortOrder: 2 },
  { id: 'qc-doc', label: 'Test certificate', sortOrder: 3 },
]

const BY_OPERATION_NAME: Record<string, QcChecklistItem[]> = {
  Welding: WELDING_QC_CHECKLIST,
  Cutting: CUTTING_QC_CHECKLIST,
  Testing: TESTING_QC_CHECKLIST,
}

export function getDefaultQcChecklist(operationName: string): QcChecklistItem[] {
  return BY_OPERATION_NAME[operationName]?.map((item) => ({ ...item })) ?? []
}
