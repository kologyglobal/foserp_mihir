import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  gatePassPendingQty,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
  toJson,
} from '../shared/gate-shared.js'
import { mapPass } from '../shared/gate-mappers.js'
import { getSettingsPayload } from '../settings/settings.service.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gatePass.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { items: true },
  })
  if (!row) throw new NotFoundError('Gate pass not found')
  return row
}

export async function listGatePasses(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gatePass.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: { items: true },
    orderBy: { outwardDate: 'desc' },
  })
  let mapped = rows.map(mapPass)
  if (filter.search) {
    mapped = mapped.filter((p) =>
      matchesSearch(
        filter.search,
        p.entryNumber,
        p.responsibleEmployee,
        p.partyName,
        p.department,
        p.purpose,
        ...p.items.map((i) => i.itemDescription),
      ),
    )
  }
  return mapped
}

export async function getGatePassById(tenantId: string, id: string) {
  return mapPass(await getOrThrow(tenantId, id))
}

/** Physical item movement only — never creates accounting vouchers. */
export async function createGatePass(
  tenantId: string,
  actor: string,
  input: {
    passKind: 'returnable' | 'non_returnable'
    movementType: string
    department: string
    responsibleEmployee: string
    carriedBy?: string
    partyName?: string
    purpose: string
    expectedReturnDate?: string | null
    approverName?: string
    gate: string
    items: Array<{
      itemDescription: string
      serialNumber?: string
      quantity: number
      uom: string
      conditionOut?: string
      remarks?: string
    }>
    submitForApproval?: boolean
  },
) {
  if (input.passKind === 'returnable' && !input.expectedReturnDate) {
    throw new InvalidStateError('Returnable gate passes require an expected return date')
  }
  if (!input.items.length) throw new InvalidStateError('At least one item is required')
  if (input.items.some((i) => i.quantity <= 0)) {
    throw new InvalidStateError('Item quantity must be greater than zero')
  }

  const settings = await getSettingsPayload(tenantId)
  const needsApproval = settings.pass.approvalRequired
  const submit = Boolean(input.submitForApproval)
  const status = submit ? (needsApproval ? 'pending_approval' : 'approved') : 'draft'
  const approvalStatus = submit ? (needsApproval ? 'pending' : 'not_required') : 'pending'
  const now = new Date()
  const entryNumber = await nextGateNumber(tenantId, 'GP', (t) =>
    prisma.gatePass.count({ where: { tenantId: t } }),
  )

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.gatePass.create({
      data: {
        tenantId,
        entryNumber,
        status,
        passKind: input.passKind,
        movementType: input.movementType,
        department: input.department,
        responsibleEmployee: input.responsibleEmployee,
        carriedBy: input.carriedBy || input.responsibleEmployee,
        partyName: input.partyName ?? null,
        purpose: input.purpose,
        outwardDate: now,
        expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
        approverName: input.approverName ?? null,
        approvalStatus,
        returnsJson: [],
        gate: input.gate,
        createdBy: actor,
        updatedBy: actor,
        items: {
          create: input.items.map((item) => ({
            tenantId,
            itemDescription: item.itemDescription,
            serialNumber: item.serialNumber ?? null,
            quantity: item.quantity,
            uom: item.uom,
            conditionOut: item.conditionOut ?? null,
            returnedQuantity: 0,
            remarks: item.remarks ?? null,
          })),
        },
      },
      include: { items: true },
    })

    if (status === 'pending_approval') {
      const requestNumber = await nextGateNumber(tenantId, 'GAR', (t) =>
        tx.gateApproval.count({ where: { tenantId: t } }),
      )
      await tx.gateApproval.create({
        data: {
          tenantId,
          requestNumber,
          requestType: input.passKind === 'returnable' ? 'returnable_gate_pass' : 'material_outward',
          requestedBy: input.responsibleEmployee,
          subject: `${created.entryNumber} — ${input.items[0]?.itemDescription ?? created.purpose}`,
          reason: created.purpose,
          priority: 'normal',
          status: 'pending',
          sourceType: 'gate_pass',
          sourceId: created.id,
        },
      })
    }

    return created
  })

  return mapPass(row)
}

export async function submitGatePass(tenantId: string, actor: string, id: string) {
  const settings = await getSettingsPayload(tenantId)
  const pass = await getOrThrow(tenantId, id)
  if (pass.status !== 'draft') throw new InvalidStateError('Only draft passes can be submitted')
  const updated = await prisma.gatePass.update({
    where: { id },
    data: {
      status: settings.pass.approvalRequired ? 'pending_approval' : 'approved',
      approvalStatus: settings.pass.approvalRequired ? 'pending' : 'not_required',
      updatedBy: actor,
    },
    include: { items: true },
  })
  return mapPass(updated)
}

export async function approveGatePass(
  tenantId: string,
  actor: string,
  id: string,
  remarks?: string,
) {
  const pass = await getOrThrow(tenantId, id)
  if (pass.status !== 'pending_approval') {
    throw new InvalidStateError('Only passes awaiting approval can be approved')
  }
  const updated = await prisma.gatePass.update({
    where: { id },
    data: {
      status: 'approved',
      approvalStatus: 'approved',
      approvalRemarks: remarks ?? null,
      approverName: actor,
      updatedBy: actor,
    },
    include: { items: true },
  })
  return mapPass(updated)
}

export async function rejectGatePass(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Rejection remarks are required')
  const pass = await getOrThrow(tenantId, id)
  if (pass.status !== 'pending_approval') {
    throw new InvalidStateError('Only passes awaiting approval can be rejected')
  }
  const updated = await prisma.gatePass.update({
    where: { id },
    data: {
      status: 'rejected',
      approvalStatus: 'rejected',
      approvalRemarks: remarks,
      updatedBy: actor,
    },
    include: { items: true },
  })
  return mapPass(updated)
}

export async function markGatePassSentOut(tenantId: string, actor: string, id: string) {
  const pass = await getOrThrow(tenantId, id)
  if (pass.status !== 'approved') {
    throw new InvalidStateError('Only approved passes can be sent out')
  }
  const updated = await prisma.gatePass.update({
    where: { id },
    data: { status: 'sent_out', outwardDate: new Date(), updatedBy: actor },
    include: { items: true },
  })
  return mapPass(updated)
}

export async function recordGatePassReturn(
  tenantId: string,
  actor: string,
  id: string,
  input: {
    itemId: string
    returnDate: string
    returnedQuantity: number
    conditionReturned?: string
    damage?: string
    remarks?: string
  },
) {
  const settings = await getSettingsPayload(tenantId)
  const pass = await getOrThrow(tenantId, id)
  if (['closed', 'cancelled', 'written_off', 'draft', 'rejected'].includes(pass.status)) {
    throw new InvalidStateError(`Returns cannot be recorded on a ${pass.status.replace(/_/g, ' ')} pass`)
  }
  const item = pass.items.find((i) => i.id === input.itemId)
  if (!item) throw new NotFoundError('Gate pass item not found')
  const pending = item.quantity - item.returnedQuantity
  if (input.returnedQuantity <= 0) {
    throw new InvalidStateError('Returned quantity must be greater than zero')
  }
  if (input.returnedQuantity > pending) {
    throw new InvalidStateError(
      `Returned quantity (${input.returnedQuantity}) cannot exceed pending quantity (${pending})`,
    )
  }
  if (!settings.pass.partialReturnAllowed && input.returnedQuantity < pending) {
    throw new InvalidStateError('Partial returns are disabled in gate settings')
  }

  const returns = Array.isArray(pass.returnsJson) ? [...(pass.returnsJson as unknown[])] : []
  returns.push({
    id: crypto.randomUUID(),
    returnDate: input.returnDate,
    itemId: input.itemId,
    returnedQuantity: input.returnedQuantity,
    conditionReturned: input.conditionReturned,
    damage: input.damage,
    remarks: input.remarks,
    recordedBy: actor,
  })

  const newReturned = item.returnedQuantity + input.returnedQuantity
  const updatedItems = pass.items.map((i) =>
    i.id === item.id ? { ...i, returnedQuantity: newReturned } : i,
  )
  const status = gatePassPendingQty(updatedItems) === 0 ? 'returned' : 'partially_returned'

  const updated = await prisma.$transaction(async (tx) => {
    await tx.gatePassItem.update({
      where: { id: item.id },
      data: { returnedQuantity: newReturned },
    })
    return tx.gatePass.update({
      where: { id },
      data: { status, returnsJson: toJson(returns), updatedBy: actor },
      include: { items: true },
    })
  })

  await pushGateActivity(tenantId, actor, {
    event: 'gate_pass_returned',
    recordType: 'gate_pass',
    recordId: updated.id,
    recordLabel: `${updated.entryNumber} — ${item.itemDescription}`,
    company: updated.partyName,
    gate: updated.gate,
    status: updated.status,
  })

  return mapPass(updated)
}

export async function closeGatePass(
  tenantId: string,
  actor: string,
  id: string,
  remarks?: string,
) {
  const pass = await getOrThrow(tenantId, id)
  if (['closed', 'cancelled'].includes(pass.status)) {
    throw new InvalidStateError('Pass is already closed')
  }
  const pending = gatePassPendingQty(pass.items)
  if (pass.passKind === 'returnable' && pending > 0 && !remarks?.trim()) {
    throw new InvalidStateError('Closing with pending quantity requires remarks (write-off justification)')
  }
  const status = pass.passKind === 'returnable' && pending > 0 ? 'written_off' : 'closed'
  const updated = await prisma.gatePass.update({
    where: { id },
    data: {
      status,
      approvalRemarks: remarks ?? pass.approvalRemarks,
      updatedBy: actor,
    },
    include: { items: true },
  })
  return mapPass(updated)
}
