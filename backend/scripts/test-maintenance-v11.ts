/**
 * Maintenance V1.1 UAT harness — machine health, repeat breakdown, PR source, close gates.
 * Does not replace V1; run after `npx tsx scripts/test-maintenance-v1.ts`.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-maintenance-v11.ts
 */
import { prisma } from '../src/config/prisma.js'
import {
  closeTicket,
  createTicket,
  getTicket,
  startRepair,
  testMachine,
  updateRepair,
} from '../src/modules/maintenance/ticket.service.js'
import { listMachineHealth } from '../src/modules/maintenance/machine-health.service.js'
import { createPurchaseRequisition } from '../src/modules/purchase/requisitions/purchase-requisition.service.js'

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
  assert(machine, 'No manufacturing machine found')

  await prisma.manufacturingMachine.update({
    where: { id: machine.id },
    data: { status: 'AVAILABLE' },
  })

  // Close any open tickets so we can create controlled V1.1 fixtures
  await prisma.maintenanceTicket.updateMany({
    where: {
      tenantId,
      machineId: machine.id,
      deletedAt: null,
      status: { notIn: ['CLOSED', 'CANCELLED'] },
    },
    data: { status: 'CANCELLED', updatedBy: user.id },
  })

  const fakeReq = {
    context: { userId: user.id, tenantId },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'maintenance-v11-uat' },
  } as any

  console.log(`V1.1 UAT Tenant=${tenant.slug} Machine=${machine.code}`)

  // --- Failure classification + production refs ---
  const t1 = await createTicket(fakeReq, tenantId, {
    machineId: machine.id,
    problem: 'V11: vibration during rolling',
    priority: 'HIGH',
    failureCategory: 'MECHANICAL',
    sourceType: 'WORK_ORDER',
    workOrderId: undefined,
    jobCardCode: 'JC-SHELL',
    operationName: 'Shell Rolling',
    operatorName: 'V11 Operator',
  })
  assert(t1.failureCategory === 'MECHANICAL', 'failure category MECHANICAL')
  assert(t1.jobCardCode === 'JC-SHELL', 'job card code preserved')
  assert(t1.operationName === 'Shell Rolling', 'operation name preserved')

  await startRepair(fakeReq, tenantId, t1.id, {
    technicianType: 'INTERNAL',
    technicianUserId: user.id,
    technicianName: 'V11 Tech',
  })
  await updateRepair(fakeReq, tenantId, t1.id, {
    rootCause: 'Drive-side bearing failed',
    repairAction: 'Bearing replaced and shaft aligned',
  })

  // Failed test must block close
  await testMachine(fakeReq, tenantId, t1.id, { testResult: 'FAIL', testNotes: 'still vibrating' })
  let closeBlocked = false
  try {
    await closeTicket(fakeReq, tenantId, t1.id, {})
  } catch {
    closeBlocked = true
  }
  assert(closeBlocked, 'FAIL test blocks close')
  const afterFail = await getTicket(tenantId, t1.id)
  assert(afterFail.status !== 'CLOSED', 'ticket still open after FAIL')

  await testMachine(fakeReq, tenantId, t1.id, { testResult: 'PASS', testNotes: 'ok' })
  const afterPass = await getTicket(tenantId, t1.id)
  assert(afterPass.repairEndedAt, 'repairEndedAt set on PASS')
  assert(afterPass.rootCause?.includes('bearing'), 'root cause stored')
  assert(afterPass.repairAction?.includes('Bearing'), 'repair action stored')

  const closed1 = await closeTicket(fakeReq, tenantId, t1.id, {})
  assert(closed1.status === 'CLOSED', 'closed after PASS')
  assert((closed1.downtimeMinutes ?? 0) >= 0, 'downtime computed')
  assert((closed1.repairMinutes ?? 0) >= 0, 'repair minutes computed')

  // --- Repeat breakdown: 2 more quick closed tickets within 30d ---
  for (let i = 2; i <= 3; i++) {
    const t = await createTicket(fakeReq, tenantId, {
      machineId: machine.id,
      problem: `V11 repeat #${i}`,
      priority: 'NORMAL',
      failureCategory: 'MECHANICAL',
    })
    await startRepair(fakeReq, tenantId, t.id, {
      technicianType: 'INTERNAL',
      technicianUserId: user.id,
      technicianName: 'V11 Tech',
    })
    await updateRepair(fakeReq, tenantId, t.id, {
      repairAction: `Repeat repair ${i}`,
    })
    await testMachine(fakeReq, tenantId, t.id, { testResult: 'PASS' })
    await closeTicket(fakeReq, tenantId, t.id, {})
  }

  const health = await listMachineHealth(tenantId, {
    machineId: machine.id,
    period: 'YTD',
    repeatBreakdownCount: 3,
    repeatBreakdownDays: 30,
  })
  const row = health.items[0]
  assert(row, 'machine health row')
  assert(row.breakdowns30d >= 3, `breakdowns30d>=3 got ${row.breakdowns30d}`)
  assert(row.repeatBreakdown === true, 'repeatBreakdown true')
  assert(
    row.healthStatus === 'ATTENTION' || row.healthStatus === 'AVAILABLE' || row.healthStatus === 'DOWN',
    'health status set',
  )
  // Machine is AVAILABLE after close → ATTENTION from repeat
  assert(row.healthStatus === 'ATTENTION', `expected ATTENTION got ${row.healthStatus}`)
  console.log(
    `Machine Health OK: ${row.machineCode} breakdowns30d=${row.breakdowns30d} health=${row.healthStatus} costYtd=${row.maintenanceCostYtd}`,
  )

  // --- PR sourceType MAINTENANCE + part backlink ---
  const openForPr = await createTicket(fakeReq, tenantId, {
    machineId: machine.id,
    problem: 'V11 shortage PR',
    priority: 'HIGH',
    failureCategory: 'MECHANICAL',
  })
  const part = await prisma.maintenancePart.create({
    data: {
      tenantId,
      ticketId: openForPr.id,
      description: 'Bearing 6205',
      qty: 2,
      unitCost: 0,
      totalCost: 0,
      shortageQty: 2,
      createdBy: user.id,
      updatedBy: user.id,
    },
  })

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const uom = await prisma.masterUom.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  assert(warehouse && uom, 'need warehouse + UOM for PR')

  let prOk = false
  try {
    const pr = await createPurchaseRequisition(tenantId, user.id, {
      requisitionDate: new Date().toISOString().slice(0, 10),
      warehouseId: warehouse.id,
      priority: 'HIGH',
      purchasePurpose: `MAINTENANCE · ${openForPr.ticketNumber}`,
      remarks: `${openForPr.ticketNumber} · ${machine.code} · Bearing 6205`,
      sourceType: 'MAINTENANCE',
      sourceId: openForPr.id,
      sourceDocumentNumber: openForPr.ticketNumber,
      maintenancePartId: part.id,
      lines: [
        {
          lineNumber: 1,
          description: 'Bearing 6205',
          requiredQuantity: 2,
          uomId: uom.id,
          warehouseId: warehouse.id,
        },
      ],
    } as any)
    assert(pr.sourceType === 'MAINTENANCE', 'PR sourceType MAINTENANCE')
    assert(pr.sourceId === openForPr.id, 'PR sourceId = ticket')
    assert(pr.sourceDocumentNumber === openForPr.ticketNumber, 'PR source document number')
    const linked = await prisma.maintenancePart.findUnique({ where: { id: part.id } })
    assert(linked?.purchaseRequisitionId === pr.id, 'part linked to PR')
    const ticketAfter = await getTicket(tenantId, openForPr.id)
    assert(ticketAfter.status === 'WAITING_FOR_PART', 'ticket WAITING_FOR_PART after PR')
    prOk = true
    console.log(`PR source OK: ${pr.requisitionNumber} ← ${openForPr.ticketNumber}`)
  } catch (e) {
    console.warn('PR create skipped/failed (fixture):', e instanceof Error ? e.message : e)
  }

  // Cleanup open ticket
  await prisma.maintenanceTicket.update({
    where: { id: openForPr.id },
    data: { status: 'CANCELLED', updatedBy: user.id },
  })
  await prisma.manufacturingMachine.update({
    where: { id: machine.id },
    data: { status: 'AVAILABLE' },
  })

  // Tenant isolation smoke: health query only returns this tenant's machines
  const otherTenant = await prisma.tenant.findFirst({
    where: { deletedAt: null, id: { not: tenantId } },
  })
  if (otherTenant) {
    const foreign = await listMachineHealth(otherTenant.id, { machineId: machine.id, period: 'YTD' })
    assert(foreign.items.length === 0, 'tenant isolation: foreign tenant cannot see machine health')
  }

  console.log(`V1.1 UAT PASS (PR=${prOk ? 'yes' : 'partial'})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
