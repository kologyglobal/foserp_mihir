/**
 * Maintenance V2 UAT — Preventive Maintenance plan → ticket → close → next due.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-maintenance-v2.ts
 */
import { prisma } from '../src/config/prisma.js'
import {
  addFrequency,
  createPlan,
  createTicketFromPlan,
  deactivatePlan,
  getPlan,
} from '../src/modules/maintenance/pm.service.js'
import {
  closeTicket,
  startRepair,
  testMachine,
  updateRepair,
} from '../src/modules/maintenance/ticket.service.js'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } })
  assert(tenant, 'No tenant')
  const tenantId = tenant.id
  const user = await prisma.user.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  assert(user, 'No user')
  const machine = await prisma.manufacturingMachine.findFirst({
    where: { tenantId, deletedAt: null, isActive: true },
    orderBy: { code: 'asc' },
  })
  assert(machine, 'No machine')

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

  const fakeReq = {
    context: { userId: user.id, tenantId },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'maintenance-v2-uat' },
  } as any

  console.log(`V2 UAT Tenant=${tenant.slug} Machine=${machine.code}`)

  const plan = await createPlan(fakeReq, tenantId, {
    machineId: machine.id,
    name: 'V2 Monthly Service',
    description: 'UAT preventive plan',
    frequencyType: 'MONTHS',
    frequencyValue: 1,
    startDate: todayIso(),
    nextDueDate: todayIso(),
    checklist: [
      { text: 'Clean machine', sequence: 1 },
      { text: 'Check lubrication', sequence: 2 },
    ],
    isActive: true,
  })
  assert(plan.planNumber.startsWith('PM-'), `plan number ${plan.planNumber}`)
  assert(plan.dueStatus === 'DUE' || plan.dueStatus === 'OVERDUE', `dueStatus=${plan.dueStatus}`)
  assert(plan.canCreateTicket, 'canCreateTicket')

  const mBefore = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(mBefore?.status === 'AVAILABLE', 'machine stays AVAILABLE when PM due (no auto DOWN)')

  const ticket = await createTicketFromPlan(fakeReq, tenantId, plan.id, { priority: 'NORMAL' })
  assert(ticket.sourceType === 'PREVENTIVE', 'source PREVENTIVE')
  assert(ticket.preventiveMaintenancePlanId === plan.id, 'plan linked')
  assert((ticket.checklistItems?.length ?? 0) === 2, 'checklist copied')

  const mAfterCreate = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(mAfterCreate?.status === 'AVAILABLE', 'PM ticket create does not set OUT_OF_SERVICE')

  let dupBlocked = false
  try {
    await createTicketFromPlan(fakeReq, tenantId, plan.id, {})
  } catch {
    dupBlocked = true
  }
  assert(dupBlocked, 'duplicate open PM ticket blocked')

  await startRepair(fakeReq, tenantId, ticket.id, {
    technicianType: 'INTERNAL',
    technicianUserId: user.id,
    technicianName: 'V2 Tech',
    operatorName: 'V2 Operator',
  })
  const mAfterStart = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(mAfterStart?.status === 'UNDER_MAINTENANCE', 'start → UNDER_MAINTENANCE')

  const checklistItems = (ticket.checklistItems ?? []).map((c: { id: string }) => ({
    id: c.id,
    isDone: true,
    remark: 'ok',
  }))
  // Reload ticket for checklist ids if mapTicket shape differs
  const fresh = await prisma.maintenanceTicketChecklistItem.findMany({
    where: { ticketId: ticket.id, tenantId },
  })
  await updateRepair(fakeReq, tenantId, ticket.id, {
    repairAction: 'Monthly service completed',
    checklistItems: fresh.map((c) => ({ id: c.id, isDone: true, remark: 'done' })),
  })

  await testMachine(fakeReq, tenantId, ticket.id, { result: 'PASS', remarks: 'ok' })
  const closed = await closeTicket(fakeReq, tenantId, ticket.id, { closingRemarks: 'PM done' })
  assert(closed.status === 'CLOSED', 'closed')

  const planAfter = await getPlan(tenantId, plan.id)
  assert(planAfter.lastCompletedDate === todayIso(), 'lastCompletedDate set')
  const expectedNext = addFrequency(new Date(`${todayIso()}T00:00:00.000Z`), 'MONTHS', 1)
    .toISOString()
    .slice(0, 10)
  assert(planAfter.nextDueDate === expectedNext, `nextDue expected ${expectedNext} got ${planAfter.nextDueDate}`)
  assert(planAfter.dueStatus === 'UPCOMING', 'back to UPCOMING')

  const mAfterClose = await prisma.manufacturingMachine.findUnique({ where: { id: machine.id } })
  assert(mAfterClose?.status === 'AVAILABLE', 'machine AVAILABLE after PM close')

  // Overdue plan create ticket
  const overduePlan = await createPlan(fakeReq, tenantId, {
    machineId: machine.id,
    name: 'V2 Overdue Plan',
    frequencyType: 'DAYS',
    frequencyValue: 7,
    startDate: '2026-01-01',
    nextDueDate: '2026-01-01',
    checklist: [{ text: 'Inspect', sequence: 1 }],
    isActive: true,
  })
  assert(overduePlan.dueStatus === 'OVERDUE', 'overdue status')
  const overdueTicket = await createTicketFromPlan(fakeReq, tenantId, overduePlan.id, {})
  assert(overdueTicket.sourceType === 'PREVENTIVE', 'overdue ticket created')
  await prisma.maintenanceTicket.update({
    where: { id: overdueTicket.id },
    data: { status: 'CANCELLED', updatedBy: user.id },
  })

  const deactivated = await deactivatePlan(fakeReq, tenantId, overduePlan.id)
  assert(deactivated.isActive === false, 'deactivated')
  let deactBlocked = false
  try {
    await createTicketFromPlan(fakeReq, tenantId, overduePlan.id, {})
  } catch {
    deactBlocked = true
  }
  assert(deactBlocked, 'deactivated plan cannot create ticket')

  const otherTenant = await prisma.tenant.findFirst({
    where: { deletedAt: null, id: { not: tenantId } },
  })
  if (otherTenant) {
    let iso = false
    try {
      await getPlan(otherTenant.id, plan.id)
    } catch {
      iso = true
    }
    assert(iso, 'tenant isolation on getPlan')
  }

  console.log('V2 UAT PASS', {
    plan: plan.planNumber,
    nextDue: planAfter.nextDueDate,
    ticket: closed.ticketNumber,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
