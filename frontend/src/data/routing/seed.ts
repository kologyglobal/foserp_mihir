import type { RoutingHeader, RoutingOperation } from '../../types/routing'
import type { QcChecklistItem } from '../../types/qc'
import { getDefaultQcChecklist, WELDING_QC_CHECKLIST } from './qcChecklists'

const now = () => new Date().toISOString()
const effective = '2026-04-01'

export const seedRoutingHeaders: RoutingHeader[] = [
  {
    id: 'rtg-bulker-a',
    routingNo: 'RTG-45M3-BULKER-001',
    productId: 'prod-45m3',
    revision: 'Rev-A',
    description: 'Standard manufacturing routing — 45 M3 Bulker Trailer',
    status: 'released',
    previousRevisionId: null,
    effectiveFrom: effective,
    totalStdHours: 186,
    approvedBy: 'Production Manager',
    approvedAt: now(),
    submittedAt: now(),
    submittedBy: 'Process Engineer',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'rtg-iso-a',
    routingNo: 'RTG-ISO-TANK-001',
    productId: 'prod-iso',
    revision: 'Rev-A',
    description: 'ISO Tank manufacturing routing — draft',
    status: 'draft',
    previousRevisionId: null,
    effectiveFrom: effective,
    totalStdHours: 0,
    approvedBy: null,
    approvedAt: null,
    submittedAt: null,
    submittedBy: null,
    createdAt: now(),
    updatedAt: now(),
  },
]

function op(
  id: string,
  routingHeaderId: string,
  operationCode: string,
  sequenceNo: number,
  operationName: string,
  workCenterId: string,
  standardHours: number,
  setupTimeHours: number,
  runTimeHours: number,
  laborRequirement: number,
  qcRequired: boolean,
  outsourced: boolean,
  sortOrder: number,
  qcChecklist?: QcChecklistItem[],
): RoutingOperation {
  const checklist = qcChecklist ?? (qcRequired ? getDefaultQcChecklist(operationName) : [])
  return {
    id,
    routingHeaderId,
    operationCode,
    sequenceNo,
    operationName,
    workCenterId,
    standardHours,
    setupTimeHours,
    runTimeHours,
    laborRequirement,
    qcRequired,
    outsourced,
    sortOrder,
    qcChecklist: checklist,
  }
}

/** 45 M3 Bulker — sequence 10–100 */
export const seedRoutingOperations: RoutingOperation[] = [
  op('rop-b-10', 'rtg-bulker-a', 'OP-010', 10, 'Cutting', 'wc-cutting', 18, 2, 16, 2, true, false, 10),
  op('rop-b-20', 'rtg-bulker-a', 'OP-020', 20, 'Rolling', 'wc-rolling', 22, 3, 19, 3, true, false, 20),
  op('rop-b-30', 'rtg-bulker-a', 'OP-030', 30, 'Tank Assembly', 'wc-tank-asm', 24, 2, 22, 4, true, false, 30),
  op('rop-b-40', 'rtg-bulker-a', 'OP-040', 40, 'Welding', 'wc-welding', 28, 2, 26, 4, true, false, 40, WELDING_QC_CHECKLIST),
  op('rop-b-50', 'rtg-bulker-a', 'OP-050', 50, 'Chassis Assembly', 'wc-chassis', 20, 2, 18, 3, false, false, 50),
  op('rop-b-60', 'rtg-bulker-a', 'OP-060', 60, 'Running Gear Fitment', 'wc-rung', 16, 1, 15, 3, false, false, 60),
  op('rop-b-70', 'rtg-bulker-a', 'OP-070', 70, 'Pneumatic Installation', 'wc-pneu', 14, 1, 13, 2, true, false, 70),
  op('rop-b-80', 'rtg-bulker-a', 'OP-080', 80, 'Electrical', 'wc-elec', 12, 1, 11, 2, true, false, 80),
  op('rop-b-90', 'rtg-bulker-a', 'OP-090', 90, 'Painting', 'wc-paint', 20, 4, 16, 3, true, true, 90),
  op('rop-b-100', 'rtg-bulker-a', 'OP-100', 100, 'Testing', 'wc-test', 12, 1, 11, 2, true, false, 100),
]
