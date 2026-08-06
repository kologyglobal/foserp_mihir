/**
 * Probe live DB + local Prisma client for POST /purchase/requisitions/:id/approve failures.
 *
 * Usage (point backend/.env at stage DB):
 *   PR_ID=4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba TENANT_SLUG=vasant-trailers npx tsx scripts/probe-pr-approve-live.ts
 */
import { prisma } from '../src/config/prisma.js'

const PR_ID = process.env.PR_ID ?? '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba'
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

const linesWithItemInclude = {
  orderBy: { lineNumber: 'asc' as const },
  include: { item: { select: { productType: true } } },
} as const

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    const err = e as { code?: string; message?: string; meta?: unknown }
    console.log(`✗ ${name}`)
    console.log('  code:', err.code ?? '(none)')
    console.log('  message:', err.message)
    if (err.meta) console.log('  meta:', JSON.stringify(err.meta))
    throw e
  }
}

async function main() {
  const db = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`
  console.log('Connected to:', db[0]?.db)
  console.log('PR_ID:', PR_ID, 'TENANT_SLUG:', TENANT_SLUG)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
    select: { id: true, slug: true },
  })
  if (!tenant) {
    console.error('Tenant not found:', TENANT_SLUG)
    process.exit(1)
  }
  console.log('Tenant id:', tenant.id)

  let pr: Awaited<ReturnType<typeof prisma.purchaseRequisition.findFirst>> | null = null

  await step('purchaseRequisition.findFirst (loadOrThrow path)', async () => {
    pr = await prisma.purchaseRequisition.findFirst({
      where: { id: PR_ID, tenantId: tenant.id, deletedAt: null },
      include: { lines: linesWithItemInclude },
    })
    if (!pr) throw new Error('PR not found or deleted')
    console.log(
      `  number=${pr.requisitionNumber} status=${pr.status} rfqRequired=${pr.rfqRequired} lines=${pr.lines.length}`,
    )
  })

  await step('purchaseApproval.findFirst (pending approval)', async () => {
    const pending = await prisma.purchaseApproval.findFirst({
      where: { tenantId: tenant.id, purchaseRequisitionId: PR_ID, status: 'PENDING' },
      orderBy: { level: 'asc' },
    })
    console.log(`  pending=${pending ? `level ${pending.level} role=${pending.approverRole}` : 'none'}`)
  })

  await step('purchaseSettings.approverLimits (assertApprovalAssignedToActor)', async () => {
    const settings = await prisma.purchaseSettings.findUnique({
      where: { tenantId: tenant.id },
      select: {
        approverLimits: {
          where: { isActive: true },
          select: { maxAmountInr: true, documentType: true, userId: true },
          take: 3,
        },
      },
    })
    console.log(`  approverLimitRows=${settings?.approverLimits.length ?? 0}`)
  })

  await step('purchaseRequisitionLine.aggregate (approval amount)', async () => {
    const agg = await prisma.purchaseRequisitionLine.aggregate({
      where: { purchaseRequisitionId: PR_ID, tenantId: tenant.id },
      _sum: { estimatedAmount: true },
    })
    console.log(`  estimatedTotal=${Number(agg._sum.estimatedAmount ?? 0)}`)
  })

  if (pr && !pr.rfqRequired) {
    await step('purchasePlanningRow.findFirst (planning sync pre-check)', async () => {
      const existing = await prisma.purchasePlanningRow.findFirst({
        where: {
          tenantId: tenant.id,
          purchaseRequisitionId: PR_ID,
          deletedAt: null,
        },
      })
      console.log(`  existingPlanningRows=${existing ? 1 : 0}`)
    })

    await step('Dry-run planning row shape (create without commit)', async () => {
      const line = pr!.lines[0]
      if (!line) {
        console.log('  skip — no lines')
        return
      }
      await prisma.$transaction(async (tx) => {
        await tx.purchasePlanningRow.create({
          data: {
            tenantId: tenant.id,
            planningNumber: `PROBE-PPS-${Date.now()}`,
            planningDate: new Date(),
            purchaseRequisitionId: pr!.id,
            purchaseRequisitionLineId: line.id,
            purchaseRequisitionNumberSnapshot: pr!.requisitionNumber,
            departmentId: pr!.departmentId,
            requestedById: pr!.requestedById,
            itemId: line.itemId,
            itemCodeSnapshot: line.itemCodeSnapshot,
            itemNameSnapshot: line.itemNameSnapshot,
            itemDescriptionSnapshot: line.description,
            requiredQuantity: line.requiredQuantity,
            uomId: line.uomId,
            currentStockQuantity: 0,
            openPurchaseOrderQuantity: 0,
            netPurchaseQuantity: line.requiredQuantity,
            allocatedQuantity: line.requiredQuantity,
            preferredVendorId: line.preferredVendorId,
            selectedVendorId: line.preferredVendorId,
            lastPurchaseVendorId: line.preferredVendorId,
            lastPurchaseRate: Number(line.estimatedRate) > 0 ? line.estimatedRate : null,
            expectedRate: line.estimatedRate,
            estimatedAmount: line.estimatedAmount,
            requiredDate: line.requiredDate ?? pr!.requiredDate,
            purchaseType: 'DIRECT_PURCHASE',
            priority: pr!.priority,
            status: 'PENDING_PLANNING',
            createdById: pr!.createdById,
            updatedById: pr!.createdById,
          },
        })
        throw new Error('ROLLBACK_PROBE')
      })
    }).catch((e: Error) => {
      if (e.message === 'ROLLBACK_PROBE') {
        console.log('✓ Dry-run planning row shape (create without commit)')
        return
      }
      throw e
    })
  } else {
    console.log('— skip planning sync probe (rfqRequired=true or PR missing)')
  }

  await step('purchaseStatusHistory.create (status history shape)', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseStatusHistory.create({
        data: {
          tenantId: tenant.id,
          documentType: 'PURCHASE_REQUISITION',
          documentId: PR_ID,
          documentNumber: pr?.requisitionNumber ?? 'PROBE',
          action: 'PROBE_APPROVE',
          fromStatus: pr?.status ?? null,
          toStatus: 'APPROVED',
          actorId: pr?.createdById,
          remarks: 'probe rollback',
        },
      })
      throw new Error('ROLLBACK_PROBE')
    })
  }).catch((e: Error) => {
    if (e.message === 'ROLLBACK_PROBE') {
      console.log('✓ purchaseStatusHistory.create (status history shape)')
      return
    }
    throw e
  })

  console.log(
    '\nAll PR approve Prisma steps OK locally — if stage API still 500, redeploy Hostinger (stale prisma client) or run live-fix-pr-approve-500.sql.',
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('\nProbe failed — fix the failing step (SQL column/table or prisma generate on Hostinger).')
  console.error(e)
  process.exit(1)
})
