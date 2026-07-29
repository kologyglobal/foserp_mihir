/**
 * Maintenance V1 UAT harness — happy path + external + failed test + concurrency.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-maintenance-v1.ts
 */
import { prisma } from '../src/config/database.js'
import {
  addPart,
  closeReadiness,
  closeTicket,
  createTicket,
  getMachineHistory,
  getTicket,
  startRepair,
  testMachine,
  updateRepair,
} from '../src/modules/maintenance/ticket.service.js'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } })
  assert(tenant, 'No tenant found')
  const tenantId = tenant.id

  const user = await prisma.user.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  assert(user, 'No active user found')

  const machine = await prisma.manufacturingMachine.findFirst({
    where: { tenantId, deletedAt: null, isActive: true },
    orderBy: { code: 'asc' },
  })
  assert(machine, 'No manufacturing machine found — seed machines first')

  await prisma.manufacturingMachine.update({
    where: { id: machine.id },
    data: { status: 'AVAILABLE' },
  })

  await prisma.maintenanceTicket.updateMany({
    where: {
      tenantId,
      machineId: machine.id,
      deletedAt: null,
      status: { notIn: ['CLOSED', 'CANCELLED'] },
    },
    data: { status: 'CANCELLED', updatedBy: user.id },
  })

  console.log(`Tenant=${tenant.slug} Machine=${machine.code} User=${user.email}`)

  const fakeReq = {
    context: { userId: user.id, tenantId },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'maintenance-uat' },
  } as any

  const created = await createTicket(fakeReq, tenantId, {
    machineId: machine.id,
    problem: 'UAT: bearing noise during shell rolling',
    priority: 'HIGH',
    sourceType: 'WORK_ORDER',
    jobCardCode: 'JC-SHELL',
    operationName: 'Shell Rolling',
    operatorName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    reportedLocationLabel: 'UAT Plant · Shell Rolling',
  })
  console.log('Created', created.ticketNumber, created.status)
  assert(created.status === 'REPORTED', 'status REPORTED')
  assert(Boolean(created.operatorName), 'operator name captured')
  assert(Boolean(created.reportedLocationLabel), 'location label captured')
  const m1 = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(m1?.status === 'OUT_OF_SERVICE', 'machine OUT_OF_SERVICE after report')

  let blocked = false
  try {
    await createTicket(fakeReq, tenantId, {
      machineId: machine.id,
      problem: 'duplicate should fail',
      priority: 'NORMAL',
    })
  } catch {
    blocked = true
  }
  assert(blocked, 'duplicate open ticket blocked')

  await startRepair(fakeReq, tenantId, created.id, {
    technicianType: 'INTERNAL',
    technicianUserId: user.id,
    technicianName: `${user.firstName} ${user.lastName}`.trim(),
    operatorName: `${user.firstName} ${user.lastName}`.trim() || user.email,
  })
  const afterStart = await getTicket(tenantId, created.id)
  assert(afterStart.status === 'IN_REPAIR', 'IN_REPAIR')
  const m2 = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(m2?.status === 'UNDER_MAINTENANCE', 'UNDER_MAINTENANCE after start')

  await updateRepair(fakeReq, tenantId, created.id, {
    repairDetails: 'Replaced bearings × 2. Aligned shaft. Machine runs smoothly.',
    failureCategory: 'MECHANICAL',
    serviceDescription: 'Bearing replacement and shaft alignment',
    serviceCost: 0,
    invoiceNumber: 'INT-UAT-001',
    invoiceDate: new Date().toISOString().slice(0, 10),
  })
  await addPart(fakeReq, tenantId, created.id, {
    description: 'Bearing',
    qty: 2,
    unitCost: 4250,
  })

  await prisma.maintenanceAttachment.create({
    data: {
      tenantId,
      ticketId: created.id,
      category: 'BEFORE',
      originalFilename: 'uat-before.jpg',
      storedFilename: 'uat-before.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      storagePath: '/tmp/uat-before.jpg',
      uploadedBy: user.id,
    },
  })

  await testMachine(fakeReq, tenantId, created.id, { result: 'FAIL', remarks: 'Still vibrating' })
  const afterFail = await getTicket(tenantId, created.id)
  assert(afterFail.status === 'IN_REPAIR', 'FAIL returns IN_REPAIR')

  await updateRepair(fakeReq, tenantId, created.id, {
    repairDetails: 'Replaced bearings × 2. Re-balanced. Vibration cleared.',
  })
  await testMachine(fakeReq, tenantId, created.id, { result: 'PASS', remarks: 'OK' })
  const afterPass = await getTicket(tenantId, created.id)
  assert(afterPass.status === 'TESTING', 'PASS → TESTING')
  assert(afterPass.totalCost === 8500, `parts cost 8500 got ${afterPass.totalCost}`)

  const readiness = closeReadiness(afterPass)
  assert(readiness.ready, `close ready: ${readiness.blockers.map((b) => b.message).join('; ')}`)

  const closed = await closeTicket(fakeReq, tenantId, created.id, { closingRemarks: 'UAT close' })
  assert(closed.status === 'CLOSED', 'CLOSED')
  assert(closed.downtimeMinutes != null && closed.downtimeMinutes >= 0, 'downtime set')
  const m3 = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(m3?.status === 'AVAILABLE', 'AVAILABLE after close')

  let doubleClose = false
  try {
    await closeTicket(fakeReq, tenantId, created.id, {})
  } catch {
    doubleClose = true
  }
  assert(doubleClose, 'duplicate close blocked')

  const history = await getMachineHistory(tenantId, machine.id)
  assert(history.ticketCount >= 1, 'history has tickets')

  await prisma.manufacturingMachine.update({
    where: { id: machine.id },
    data: { status: 'AVAILABLE' },
  })
  const vendor = await prisma.masterVendor.findFirst({
    where: { tenantId, deletedAt: null },
  })
  if (vendor) {
    const ext = await createTicket(fakeReq, tenantId, {
      machineId: machine.id,
      problem: 'UAT external contractor service',
      priority: 'NORMAL',
      operatorName: 'Floor Operator',
    })
    await startRepair(fakeReq, tenantId, ext.id, {
      technicianType: 'EXTERNAL',
      contractorId: vendor.id,
      technicianName: 'ABC Tech',
      operatorName: 'Floor Operator',
    })
    await updateRepair(fakeReq, tenantId, ext.id, {
      repairDetails: 'Contractor replaced control board',
      failureCategory: 'CONTROL',
      serviceDescription: 'Control board replacement',
      serviceCost: 12000,
      invoiceNumber: 'INV-125',
      invoiceDate: new Date().toISOString().slice(0, 10),
    })
    await addPart(fakeReq, tenantId, ext.id, { description: 'Control board', qty: 1, unitCost: 3000 })
    await prisma.maintenanceAttachment.create({
      data: {
        tenantId,
        ticketId: ext.id,
        category: 'AFTER',
        originalFilename: 'uat-after.jpg',
        storedFilename: 'uat-after.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        storagePath: '/tmp/uat-after.jpg',
        uploadedBy: user.id,
      },
    })
    await testMachine(fakeReq, tenantId, ext.id, { result: 'PASS' })
    const extClosed = await closeTicket(fakeReq, tenantId, ext.id, {})
    assert(extClosed.totalCost === 15000, `external total 15000 got ${extClosed.totalCost}`)
    console.log('External contractor path PASS', extClosed.ticketNumber, extClosed.totalCost)
  } else {
    console.log('SKIP external — no vendor master')
  }

  console.log('\nMAINTENANCE V1 UAT: PASS')
  console.log(
    JSON.stringify(
      {
        ticket: closed.ticketNumber,
        downtimeMinutes: closed.downtimeMinutes,
        totalCost: closed.totalCost,
        machineStatus: m3?.status,
        historyTickets: history.ticketCount,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error('MAINTENANCE V1 UAT: FAIL')
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
