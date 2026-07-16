import type { DispatchChecklistItem } from '../../types/dispatch'

/** Production dispatch checklist — mandatory factory gates + loading bay */
const PRODUCTION_CHECKLIST: Array<{ id: string; label: string; mandatory: boolean; systemGate?: boolean }> = [
  { id: 'dchk-fqc', label: 'Final QC approved', mandatory: true, systemGate: true },
  { id: 'dchk-fg', label: 'FG stock available in FG Yard', mandatory: true, systemGate: true },
  { id: 'dchk-inv', label: 'Tax invoice ready / generated', mandatory: true },
  { id: 'dchk-eway', label: 'E-way bill ready', mandatory: true },
  { id: 'dchk-warr', label: 'Warranty card attached', mandatory: true },
  { id: 'dchk-cert', label: 'Test certificate attached', mandatory: true },
  { id: 'dchk-photos', label: 'Trailer photos taken (4 sides + seal)', mandatory: true },
  { id: 'dchk-trans', label: 'Transport details confirmed', mandatory: true },
  { id: 'dchk-cust', label: 'Customer dispatch confirmation', mandatory: true },
  { id: 'dchk-secure', label: 'Trailer secured on vehicle', mandatory: true },
  { id: 'dchk-tyre', label: 'Tyre pressure & wheel nuts verified', mandatory: true },
  { id: 'dchk-pneu', label: 'Pneumatic system checked', mandatory: true },
  { id: 'dchk-plate', label: 'Trailer / chassis numbers verified', mandatory: true },
  { id: 'dchk-docs', label: 'Delivery challan & documents with driver', mandatory: true },
  { id: 'dchk-lr', label: 'LR number recorded', mandatory: true },
  { id: 'dchk-brief', label: 'Driver briefing completed', mandatory: true },
]

export function buildDefaultDispatchChecklist(): DispatchChecklistItem[] {
  return PRODUCTION_CHECKLIST.map((item, i) => ({
    id: item.id,
    label: item.label,
    sortOrder: (i + 1) * 10,
    passed: false,
    mandatory: item.mandatory,
    notes: '',
    systemGate: item.systemGate,
  }))
}

/** Suggested trailer / chassis numbers for a dispatch unit */
export function suggestTrailerIdentity(
  dispatchNo: string,
  workOrderNo: string | null,
  unitIndex: number,
): { trailerNo: string; chassisNo: string } {
  const seq = String(unitIndex + 1).padStart(2, '0')
  const wo = workOrderNo ?? 'WO'
  return {
    trailerNo: `TR-${dispatchNo}-${seq}`,
    chassisNo: `CH-${wo}-${seq}`,
  }
}
