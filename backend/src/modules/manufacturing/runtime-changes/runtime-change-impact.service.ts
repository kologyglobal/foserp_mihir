import type { Prisma, ProductionOrder, ProductionOrderOperation, ProductionOrderStage, ProductionAssignment, ProductionDemand } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { NotFoundError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/quantity.service.js'
import type { RuntimeChangeType } from './runtime-change.enums.js'
import { RuntimeChangeInvalidStateError, RuntimeChangeValidationError } from './runtime-change.errors.js'
import { parseProposedValue } from './runtime-change.schemas.js'

const TERMINAL_STAGE_STATUSES = ['COMPLETED', 'CANCELLED', 'SKIPPED']
const TERMINAL_OP_STATUSES = ['COMPLETED', 'CANCELLED', 'SKIPPED']

export interface RuntimeChangeImpactField {
  field: string
  from: unknown
  to: unknown
}

export interface RuntimeChangeImpactSummary {
  summary: string
  changes: RuntimeChangeImpactField[]
  warnings: string[]
  downstream: string[]
}

export interface RuntimeChangeContext {
  changeType: RuntimeChangeType
  order: ProductionOrder
  stage: ProductionOrderStage | null
  operation: ProductionOrderOperation | null
  assignment: ProductionAssignment | null
  demand: ProductionDemand | null
  proposedValue: Record<string, unknown>
  original: Record<string, unknown>
  proposed: Record<string, unknown>
  qtyChangePct: number | null
  delayDays: number | null
  overDemand: boolean
  mandatorySkip: boolean
  hasProgress: boolean
  impact: RuntimeChangeImpactSummary
}

export interface BuildContextInput {
  changeType: RuntimeChangeType
  stageId?: string
  operationId?: string
  assignmentId?: string
  proposedValue: unknown
}

type Db = typeof prisma | Prisma.TransactionClient

async function loadRefs(db: Db, tenantId: string, workOrderId: string, input: BuildContextInput) {
  const order = await db.productionOrder.findFirst({ where: { id: workOrderId, ...tenantActiveFilter(tenantId) } })
  if (!order) throw new NotFoundError('Work order not found')

  const stage = input.stageId
    ? await db.productionOrderStage.findFirst({ where: { id: input.stageId, productionOrderId: workOrderId, tenantId } })
    : null
  if (input.stageId && !stage) throw new NotFoundError('Stage not found on this work order')

  const operation = input.operationId
    ? await db.productionOrderOperation.findFirst({ where: { id: input.operationId, productionOrderId: workOrderId, tenantId } })
    : null
  if (input.operationId && !operation) throw new NotFoundError('Operation not found on this work order')

  const assignment = input.assignmentId
    ? await db.productionAssignment.findFirst({ where: { id: input.assignmentId, productionOrderId: workOrderId, tenantId } })
    : null
  if (input.assignmentId && !assignment) throw new NotFoundError('Assignment not found on this work order')

  const demand = order.demandId ? await db.productionDemand.findFirst({ where: { id: order.demandId, tenantId } }) : null

  return { order, stage, operation, assignment, demand }
}

/**
 * Validates + normalizes a proposed runtime change into a typed context consumed by the
 * risk, impact-preview, and apply services. Re-run at validate/submit/apply time (not just
 * at create) so state that has moved on since drafting is caught before mutation.
 */
export async function buildRuntimeChangeContext(
  tenantId: string,
  workOrderId: string,
  input: BuildContextInput,
  db: Db = prisma,
): Promise<RuntimeChangeContext> {
  const { order, stage, operation, assignment, demand } = await loadRefs(db, tenantId, workOrderId, input)

  const base: Omit<RuntimeChangeContext, 'original' | 'proposed' | 'qtyChangePct' | 'delayDays' | 'overDemand' | 'mandatorySkip' | 'hasProgress' | 'impact' | 'proposedValue'> = {
    changeType: input.changeType,
    order,
    stage,
    operation,
    assignment,
    demand,
  }

  switch (input.changeType) {
    case 'QUANTITY_CHANGE':
      return buildQuantityContext(base, input.proposedValue)
    case 'DUE_DATE_CHANGE':
      return buildDueDateContext(base, input.proposedValue)
    case 'PRIORITY_CHANGE':
      return buildPriorityContext(base, input.proposedValue)
    case 'SUPERVISOR_CHANGE':
      return buildSupervisorContext(base, input.proposedValue)
    case 'OPERATOR_CHANGE':
      return buildOperatorContext(base, input.proposedValue)
    case 'MACHINE_CHANGE':
      return buildMachineContext(base, input.proposedValue)
    case 'WORK_CENTRE_CHANGE':
      return buildWorkCentreContext(base, input.proposedValue)
    case 'ADD_OPERATION':
      return buildAddOperationContext(base, input.proposedValue)
    case 'REPEAT_OPERATION':
      return buildRepeatOperationContext(base, input.proposedValue, db, tenantId)
    case 'SKIP_OPERATION':
      return buildSkipOperationContext(base, input.proposedValue)
    case 'CONVERT_TO_JOB_WORK':
      return buildConvertToJobWorkContext(base, input.proposedValue)
    case 'WORK_ORDER_HOLD':
      return buildWorkOrderHoldContext(base, input.proposedValue)
    case 'WORK_ORDER_RESUME':
      return buildWorkOrderResumeContext(base, input.proposedValue)
    case 'STAGE_HOLD':
      return buildStageHoldContext(base, input.proposedValue)
    case 'STAGE_RESUME':
      return buildStageResumeContext(base, input.proposedValue)
    default:
      throw new RuntimeChangeValidationError(`Unsupported change type: ${input.changeType}`)
  }
}

type Base = Pick<RuntimeChangeContext, 'changeType' | 'order' | 'stage' | 'operation' | 'assignment' | 'demand'>

function finalize(
  base: Base,
  parts: Pick<RuntimeChangeContext, 'proposedValue' | 'original' | 'proposed' | 'impact'> &
    Partial<Pick<RuntimeChangeContext, 'qtyChangePct' | 'delayDays' | 'overDemand' | 'mandatorySkip' | 'hasProgress'>>,
): RuntimeChangeContext {
  return {
    ...base,
    qtyChangePct: null,
    delayDays: null,
    overDemand: false,
    mandatorySkip: false,
    hasProgress: false,
    ...parts,
  }
}

function buildQuantityContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('QUANTITY_CHANGE', raw)
  const { order, demand } = base
  const originalQty = toDecimal(order.plannedQuantity)
  const proposedQty = toDecimal(value.plannedQuantity)
  const completed = toDecimal(order.completedGoodQuantity)

  if (proposedQty.lessThanOrEqualTo(0)) {
    throw new RuntimeChangeValidationError('Proposed quantity must be greater than zero')
  }
  if (proposedQty.lessThan(completed)) {
    throw new RuntimeChangeValidationError(
      `Proposed quantity (${proposedQty}) cannot be less than completed good quantity (${completed})`,
    )
  }

  const delta = proposedQty.minus(originalQty)
  const pctChange = originalQty.greaterThan(0) ? delta.abs().dividedBy(originalQty).times(100).toNumber() : 100

  let overDemand = false
  if (demand && delta.greaterThan(0)) {
    const remaining = toDecimal(demand.remainingQuantity)
    if (delta.greaterThan(remaining)) overDemand = true
  }

  const warnings: string[] = []
  if (overDemand) {
    warnings.push(
      `Increase of ${delta} exceeds remaining sales-order demand (${toDecimal(demand!.remainingQuantity)}); requires HIGH-risk approval`,
    )
  }

  return finalize(base, {
    proposedValue: value,
    original: { plannedQuantity: originalQty.toString() },
    proposed: { plannedQuantity: proposedQty.toString() },
    qtyChangePct: pctChange,
    overDemand,
    impact: {
      summary: `Planned quantity ${originalQty} → ${proposedQty}`,
      changes: [{ field: 'plannedQuantity', from: originalQty.toString(), to: proposedQty.toString() }],
      warnings,
      downstream: [
        'Remaining (incomplete) stage/operation planned quantities will be scaled proportionally',
        demand ? 'Linked production demand converted/remaining quantity will be adjusted' : 'Not linked to a production demand',
      ],
    },
  })
}

function buildDueDateContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('DUE_DATE_CHANGE', raw)
  const original = base.order.requiredCompletionDate
  const proposed = new Date(value.requiredCompletionDate)
  if (Number.isNaN(proposed.getTime())) {
    throw new RuntimeChangeValidationError('proposedValue.requiredCompletionDate is not a valid date')
  }
  const delayDays = Math.round((proposed.getTime() - original.getTime()) / (24 * 60 * 60 * 1000))

  return finalize(base, {
    proposedValue: value,
    original: { requiredCompletionDate: original.toISOString() },
    proposed: { requiredCompletionDate: proposed.toISOString() },
    delayDays,
    impact: {
      summary: `Required completion date ${original.toISOString().slice(0, 10)} → ${proposed.toISOString().slice(0, 10)}`,
      changes: [{ field: 'requiredCompletionDate', from: original.toISOString(), to: proposed.toISOString() }],
      warnings: delayDays > 7 ? [`Delay of ${delayDays} days exceeds the default 7-day threshold`] : [],
      downstream: ['Work order health/on-track status will be recomputed on apply'],
    },
  })
}

function buildPriorityContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('PRIORITY_CHANGE', raw)
  return finalize(base, {
    proposedValue: value,
    original: { priority: base.order.priority },
    proposed: { priority: value.priority },
    impact: {
      summary: `Priority ${base.order.priority} → ${value.priority}`,
      changes: [{ field: 'priority', from: base.order.priority, to: value.priority }],
      warnings: [],
      downstream: [],
    },
  })
}

function buildSupervisorContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('SUPERVISOR_CHANGE', raw)
  return finalize(base, {
    proposedValue: value,
    original: { supervisorId: base.order.supervisorId },
    proposed: { supervisorId: value.supervisorId },
    impact: {
      summary: `Supervisor reassignment`,
      changes: [{ field: 'supervisorId', from: base.order.supervisorId, to: value.supervisorId }],
      warnings: [],
      downstream: [],
    },
  })
}

function buildOperatorContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('OPERATOR_CHANGE', raw)
  if (!base.assignment) {
    throw new RuntimeChangeValidationError('assignmentId is required for OPERATOR_CHANGE')
  }
  if (['COMPLETED', 'CANCELLED'].includes(base.assignment.status)) {
    throw new RuntimeChangeInvalidStateError(`Cannot reassign an assignment in ${base.assignment.status} status`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { userId: base.assignment.userId, employeeId: base.assignment.employeeId },
    proposed: { userId: value.userId, employeeId: value.employeeId ?? null },
    impact: {
      summary: 'Operator reassignment',
      changes: [{ field: 'userId', from: base.assignment.userId, to: value.userId }],
      warnings: [],
      downstream: ['Current assignment will be cancelled and a new assignment created for the incoming operator'],
    },
  })
}

function buildMachineContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('MACHINE_CHANGE', raw)
  if (!base.operation) {
    throw new RuntimeChangeValidationError('operationId is required for MACHINE_CHANGE')
  }
  if (TERMINAL_OP_STATUSES.includes(base.operation.status)) {
    throw new RuntimeChangeInvalidStateError(`Cannot change machine on an operation in ${base.operation.status} status`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { machineId: base.operation.machineId },
    proposed: { machineId: value.machineId },
    impact: {
      summary: 'Operation machine change',
      changes: [{ field: 'machineId', from: base.operation.machineId, to: value.machineId }],
      warnings: [],
      downstream: [],
    },
  })
}

function buildWorkCentreContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('WORK_CENTRE_CHANGE', raw)
  const target = base.operation ?? base.stage
  if (!target) {
    throw new RuntimeChangeValidationError('stageId or operationId is required for WORK_CENTRE_CHANGE')
  }
  if (TERMINAL_STAGE_STATUSES.includes(target.status)) {
    throw new RuntimeChangeInvalidStateError(`Cannot change work centre on ${target.status} stage/operation`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { workCentreId: target.workCentreId },
    proposed: { workCentreId: value.workCentreId },
    impact: {
      summary: 'Work centre change',
      changes: [{ field: 'workCentreId', from: target.workCentreId, to: value.workCentreId }],
      warnings: [],
      downstream: [],
    },
  })
}

function buildAddOperationContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('ADD_OPERATION', raw)
  if (!base.stage) {
    throw new RuntimeChangeValidationError('stageId is required for ADD_OPERATION')
  }
  if (TERMINAL_STAGE_STATUSES.includes(base.stage.status)) {
    throw new RuntimeChangeInvalidStateError(`Cannot add an operation to a ${base.stage.status} stage`)
  }
  return finalize(base, {
    proposedValue: { ...value, source: 'RUNTIME_ADDED' },
    original: {},
    proposed: { name: value.name, stageId: base.stage.id },
    impact: {
      summary: `New operation "${value.name}" added to stage "${base.stage.name}"`,
      changes: [{ field: 'operations', from: null, to: value.name }],
      warnings: [],
      downstream: ['New operation created in NOT_STARTED status; existing routing snapshot ordering is unaffected'],
    },
  })
}

async function buildRepeatOperationContext(base: Base, raw: unknown, db: Db, tenantId: string): Promise<RuntimeChangeContext> {
  const value = parseProposedValue('REPEAT_OPERATION', raw)
  const source = await db.productionOrderOperation.findFirst({
    where: { id: value.sourceOperationId, productionOrderId: base.order.id, tenantId },
  })
  if (!source) throw new NotFoundError('Source operation not found on this work order')

  return finalize(base, {
    proposedValue: { ...value, sourceOperationName: source.name },
    original: {},
    proposed: { sourceOperationId: source.id, plannedQuantity: value.plannedQuantity ?? source.plannedQuantity.toString() },
    impact: {
      summary: `Repeat of operation "${source.name}"`,
      changes: [{ field: 'operations', from: null, to: `${source.name} — Repeat` }],
      warnings: [],
      downstream: ['New operation created as a copy of the source operation (work centre, machine, quality flags)'],
    },
  })
}

function buildSkipOperationContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('SKIP_OPERATION', raw)
  if (!base.operation) {
    throw new RuntimeChangeValidationError('operationId is required for SKIP_OPERATION')
  }
  const operation = base.operation
  if (operation.status === 'COMPLETED') {
    throw new RuntimeChangeInvalidStateError('Cannot skip a completed operation')
  }
  const hasProgress = toDecimal(operation.goodQuantity).greaterThan(0)
  if (hasProgress) {
    throw new RuntimeChangeInvalidStateError('Cannot skip an operation that already has recorded good quantity')
  }
  const mandatorySkip = !operation.isOptional || operation.qualityRequired

  return finalize(base, {
    proposedValue: value,
    original: { status: operation.status },
    proposed: { status: 'SKIPPED' },
    mandatorySkip,
    impact: {
      summary: `Skip operation "${operation.name}"`,
      changes: [{ field: 'status', from: operation.status, to: 'SKIPPED' }],
      warnings: mandatorySkip
        ? ['Operation is mandatory or quality-required — skip requires approval']
        : [],
      downstream: [],
    },
  })
}

function buildConvertToJobWorkContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('CONVERT_TO_JOB_WORK', raw)
  if (base.operation && TERMINAL_OP_STATUSES.includes(base.operation.status)) {
    throw new RuntimeChangeInvalidStateError(`Cannot convert a ${base.operation.status} operation to job work`)
  }
  return finalize(base, {
    proposedValue: value,
    original: {},
    proposed: { processName: value.processName, vendorId: value.vendorId, orderedQty: value.orderedQty },
    impact: {
      summary: `Outsource "${value.processName}" to a subcontractor (DRAFT job work order)`,
      changes: [{ field: 'jobWorkOrder', from: null, to: value.processName }],
      warnings: ['Creates a DRAFT job work order only — no material dispatch or inventory movement occurs here'],
      downstream: base.operation ? ['Operation remaining quantity flagged as outsourced (tracked in change record only)'] : [],
    },
  })
}

function buildWorkOrderHoldContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('WORK_ORDER_HOLD', raw)
  if (!['READY', 'IN_PROGRESS'].includes(base.order.status)) {
    throw new RuntimeChangeInvalidStateError(`Work order can only be held from READY or IN_PROGRESS status (current: ${base.order.status})`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { status: base.order.status },
    proposed: { status: 'ON_HOLD', reasonCategory: value.reasonCategory },
    impact: {
      summary: `Hold work order (${value.reasonCategory})`,
      changes: [{ field: 'status', from: base.order.status, to: 'ON_HOLD' }],
      warnings: [],
      downstream: ['Delegates to the existing work order hold lifecycle endpoint'],
    },
  })
}

function buildWorkOrderResumeContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('WORK_ORDER_RESUME', raw)
  if (base.order.status !== 'ON_HOLD') {
    throw new RuntimeChangeInvalidStateError(`Work order can only be resumed from ON_HOLD status (current: ${base.order.status})`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { status: base.order.status },
    proposed: { status: base.order.previousStatusBeforeHold ?? 'IN_PROGRESS' },
    impact: {
      summary: 'Resume work order',
      changes: [{ field: 'status', from: base.order.status, to: base.order.previousStatusBeforeHold ?? 'IN_PROGRESS' }],
      warnings: [],
      downstream: ['Delegates to the existing work order resume lifecycle endpoint'],
    },
  })
}

function buildStageHoldContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('STAGE_HOLD', raw)
  if (!base.stage) {
    throw new RuntimeChangeValidationError('stageId is required for STAGE_HOLD')
  }
  if (!['READY', 'IN_PROGRESS'].includes(base.stage.status)) {
    throw new RuntimeChangeInvalidStateError(`Stage can only be held from READY or IN_PROGRESS status (current: ${base.stage.status})`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { status: base.stage.status },
    proposed: { status: 'ON_HOLD', reasonCategory: value.reasonCategory ?? null },
    impact: {
      summary: `Hold stage "${base.stage.name}"`,
      changes: [{ field: 'status', from: base.stage.status, to: 'ON_HOLD' }],
      warnings: [],
      downstream: ['Only this stage is held; the work order header status is unaffected'],
    },
  })
}

function buildStageResumeContext(base: Base, raw: unknown): RuntimeChangeContext {
  const value = parseProposedValue('STAGE_RESUME', raw)
  if (!base.stage) {
    throw new RuntimeChangeValidationError('stageId is required for STAGE_RESUME')
  }
  if (base.stage.status !== 'ON_HOLD') {
    throw new RuntimeChangeInvalidStateError(`Stage can only be resumed from ON_HOLD status (current: ${base.stage.status})`)
  }
  return finalize(base, {
    proposedValue: value,
    original: { status: base.stage.status },
    proposed: { status: 'IN_PROGRESS' },
    impact: {
      summary: `Resume stage "${base.stage.name}"`,
      changes: [{ field: 'status', from: base.stage.status, to: 'IN_PROGRESS' }],
      warnings: [],
      downstream: [],
    },
  })
}
