import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
} from '../shared/gate-shared.js'
import { mapContractor } from '../shared/gate-mappers.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateContractorEntry.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!row) throw new NotFoundError('Contractor entry not found')
  return row
}

export async function listContractors(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateContractorEntry.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: [{ entryTime: 'desc' }, { createdAt: 'desc' }],
  })
  let mapped = rows.map(mapContractor)
  if (filter.search) {
    mapped = mapped.filter((c) =>
      matchesSearch(
        filter.search,
        c.entryNumber,
        c.workerName,
        c.mobile,
        c.contractorCompany,
        c.department,
        c.supervisor,
      ),
    )
  }
  return mapped
}

export async function getContractorById(tenantId: string, id: string) {
  return mapContractor(await getOrThrow(tenantId, id))
}

export async function createContractorEntry(
  tenantId: string,
  actor: string,
  input: {
    workerName: string
    mobile: string
    contractorCompany: string
    workReference?: string
    department: string
    supervisor: string
    workLocation: string
    validFrom: string
    validUntil: string
    safetyInductionDone: boolean
    ppeIssued: boolean
    toolsCarried?: string
    purpose: string
    remarks?: string
    gate: string
  },
) {
  const now = new Date()
  const entryNumber = await nextGateNumber(tenantId, 'CON', (t) =>
    prisma.gateContractorEntry.count({ where: { tenantId: t } }),
  )
  const row = await prisma.gateContractorEntry.create({
    data: {
      tenantId,
      entryNumber,
      status: 'inside',
      entryTime: now,
      createdBy: actor,
      updatedBy: actor,
      ...input,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'contractor_entered',
    recordType: 'contractor',
    recordId: row.id,
    recordLabel: row.workerName,
    company: row.contractorCompany,
    gate: row.gate,
    status: 'inside',
  })
  return mapContractor(row)
}

export async function recordContractorExit(
  tenantId: string,
  actor: string,
  id: string,
  remarks?: string,
) {
  const record = await getOrThrow(tenantId, id)
  if (record.status === 'exited') {
    throw new InvalidStateError('Exit has already been recorded for this contractor')
  }
  if (record.status !== 'inside') {
    throw new InvalidStateError('Cannot record exit before entry')
  }
  const updated = await prisma.gateContractorEntry.update({
    where: { id },
    data: {
      status: 'exited',
      exitTime: new Date(),
      remarks: remarks ?? record.remarks,
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'contractor_exited',
    recordType: 'contractor',
    recordId: updated.id,
    recordLabel: updated.workerName,
    company: updated.contractorCompany,
    gate: updated.gate,
    status: 'exited',
  })
  return mapContractor(updated)
}
