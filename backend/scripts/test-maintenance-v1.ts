/**
 * Maintenance V1 UAT harness — happy path + inventory ISSUE + external + failed test + concurrency.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-maintenance-v1.ts
 */
import { prisma } from '../src/config/prisma.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
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
  assert(created.inventoryPostingPending === false, 'no inventory pending on create')
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
  const afterFreeTextPart = await getTicket(tenantId, created.id)
  assert(afterFreeTextPart.inventoryPostingPending === false, 'free-text part does not leave inventory pending')
  assert(afterFreeTextPart.parts[0]?.inventoryMovementId == null, 'free-text part has no movement')

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

  // ── Inventory ISSUE for spare parts ───────────────────────────────────
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { code: 'asc' },
  })
  assert(warehouse, 'No active warehouse for spare ISSUE test')

  const spareItem = await prisma.masterItem.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      isStockable: true,
      isBlocked: false,
      status: 'ACTIVE',
      batchTracked: false,
      serialTracked: false,
    },
    orderBy: { code: 'asc' },
  })
  assert(spareItem, 'No stockable non-batch/serial item for spare ISSUE test')

  const openingKey = `MT_UAT_OPN:${spareItem.id}:${warehouse.id}:${Date.now()}`
  await postStockMovement({
    tenantId,
    itemId: spareItem.id,
    warehouseId: warehouse.id,
    movementType: 'OPENING',
    referenceType: 'OPN',
    quantity: 10,
    rate: 100,
    referenceNo: 'MT-UAT-OPENING',
    remarks: 'Maintenance UAT opening stock for spare ISSUE',
    idempotencyKey: openingKey,
    createdBy: user.id,
  })

  await prisma.manufacturingMachine.update({
    where: { id: machine.id },
    data: { status: 'AVAILABLE' },
  })

  const issueTicket = await createTicket(fakeReq, tenantId, {
    machineId: machine.id,
    problem: 'UAT: inventory ISSUE spare path',
    priority: 'NORMAL',
    operatorName: 'UAT Operator',
  })
  await startRepair(fakeReq, tenantId, issueTicket.id, {
    technicianType: 'INTERNAL',
    technicianUserId: user.id,
    technicianName: 'UAT Tech',
    operatorName: 'UAT Operator',
  })

  const balanceBefore = await prisma.inventoryStockBalance.findFirst({
    where: { tenantId, itemId: spareItem.id, warehouseId: warehouse.id },
  })
  const onHandBefore = Number(balanceBefore?.onHandQty ?? 0)

  const withIssue = await addPart(fakeReq, tenantId, issueTicket.id, {
    itemId: spareItem.id,
    warehouseId: warehouse.id,
    description: `${spareItem.code} — ${spareItem.name}`,
    qty: 2,
    unitCost: 100,
  })
  const issuedPart = withIssue.parts.find((p) => p.itemId === spareItem.id)
  assert(issuedPart?.inventoryMovementId, 'stockable part posts inventory movement')
  assert(withIssue.inventoryPostingPending === false, 'inventory posting not pending after ISSUE')

  const movement = await prisma.inventoryStockMovement.findUnique({
    where: { id: issuedPart!.inventoryMovementId! },
  })
  assert(movement?.referenceType === 'ISSUE_TO_MAINTENANCE', 'referenceType ISSUE_TO_MAINTENANCE')
  assert(movement?.referenceNo === issueTicket.ticketNumber, 'referenceNo = ticket number')
  assert(Number(movement?.quantity) === -2, `issue qty -2 got ${movement?.quantity}`)

  const costEntry = await prisma.inventoryCostEntry.findFirst({
    where: { tenantId, inventoryMovementId: movement!.id },
  })
  assert(costEntry, 'cost entry created for maintenance ISSUE')
  assert(costEntry?.sourceType === 'ISSUE_TO_MAINTENANCE', 'cost entry sourceType')

  const balanceAfter = await prisma.inventoryStockBalance.findFirst({
    where: { tenantId, itemId: spareItem.id, warehouseId: warehouse.id },
  })
  assert(Number(balanceAfter?.onHandQty ?? 0) === onHandBefore - 2, 'on-hand decremented by ISSUE qty')
  console.log('Inventory ISSUE path PASS', {
    ticket: issueTicket.ticketNumber,
    movement: movement?.movementNumber,
    onHandBefore,
    onHandAfter: Number(balanceAfter?.onHandQty ?? 0),
  })

  let insufficientBlocked = false
  try {
    await addPart(fakeReq, tenantId, issueTicket.id, {
      itemId: spareItem.id,
      warehouseId: warehouse.id,
      description: `${spareItem.code} — over-issue`,
      qty: 999_999,
      unitCost: 100,
    })
  } catch {
    insufficientBlocked = true
  }
  assert(insufficientBlocked, 'insufficient stock fail-closed')

  // Close inventory ticket so machine is free for external path
  await updateRepair(fakeReq, tenantId, issueTicket.id, {
    repairDetails: 'Issued spare from stock',
    serviceDescription: 'Spare issue UAT',
    invoiceNumber: 'INT-ISSUE-001',
    invoiceDate: new Date().toISOString().slice(0, 10),
  })
  await prisma.maintenanceAttachment.create({
    data: {
      tenantId,
      ticketId: issueTicket.id,
      category: 'AFTER',
      originalFilename: 'uat-issue.jpg',
      storedFilename: 'uat-issue.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      storagePath: '/tmp/uat-issue.jpg',
      uploadedBy: user.id,
    },
  })
  await testMachine(fakeReq, tenantId, issueTicket.id, { result: 'PASS' })
  await closeTicket(fakeReq, tenantId, issueTicket.id, {})

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
        issueTicket: issueTicket.ticketNumber,
        downtimeMinutes: closed.downtimeMinutes,
        totalCost: closed.totalCost,
        machineStatus: m3?.status,
        historyTickets: history.ticketCount,
        inventoryIssue: movement?.movementNumber,
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
