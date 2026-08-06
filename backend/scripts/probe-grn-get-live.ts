/**
 * Probe live DB + local Prisma client for GET /purchase/grns/:id failures.
 *
 * Usage (point backend/.env at stage DB):
 *   GRN_ID=6e2c9d57-debc-4598-bec1-5450f63a5637 TENANT_SLUG=vasant-trailers npx tsx scripts/probe-grn-get-live.ts
 */
import { prisma } from '../src/config/prisma.js'

const GRN_ID = process.env.GRN_ID ?? '6e2c9d57-debc-4598-bec1-5450f63a5637'
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

const includeGrn = {
  lines: { orderBy: { lineNumber: 'asc' as const } },
  purchaseOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      expectedDeliveryDate: true,
      paymentTerms: true,
      deliveryTerms: true,
      currencyCode: true,
    },
  },
  vendor: { select: { id: true, code: true, name: true, gstin: true } },
  warehouse: { select: { id: true, code: true, name: true, plantId: true } },
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
  console.log('GRN_ID:', GRN_ID, 'TENANT_SLUG:', TENANT_SLUG)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
    select: { id: true, slug: true },
  })
  if (!tenant) {
    console.error('Tenant not found:', TENANT_SLUG)
    process.exit(1)
  }
  console.log('Tenant id:', tenant.id)

  await step('goodsReceipt.findFirst (includeGrn — same as GET detail)', async () => {
    const grn = await prisma.goodsReceipt.findFirst({
      where: { id: GRN_ID, tenantId: tenant.id, deletedAt: null },
      include: includeGrn,
    })
    if (!grn) {
      throw new Error('GRN not found or deleted')
    }
    console.log(`  grnNumber=${grn.grnNumber} status=${grn.status} lines=${grn.lines.length}`)
    for (const line of grn.lines) {
      console.log(
        `  line ${line.lineNumber}: toleranceStatus=${line.toleranceStatus} receivingCondition=${(line as { receivingCondition?: string }).receivingCondition ?? '?'}`,
      )
    }
  })

  await step('purchaseReturn.findMany (material returns on GRN)', async () => {
    const rows = await prisma.purchaseReturn.findMany({
      where: {
        tenantId: tenant.id,
        goodsReceiptId: GRN_ID,
        deletedAt: null,
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
      include: { lines: true },
      take: 5,
    })
    console.log(`  returns=${rows.length}`)
  })

  await step('purchaseQualityInspection.findFirst (returnable qty path)', async () => {
    const qi = await prisma.purchaseQualityInspection.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        goodsReceiptId: GRN_ID,
        status: { in: ['REJECTED', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'CLOSED'] },
      },
      orderBy: { completedAt: 'desc' },
      include: { lines: true },
    })
    console.log(`  qi=${qi?.inspectionNumber ?? 'none'}`)
  })

  await step('summarizeMaterialReturnsForGrn (full GET detail path)', async () => {
    const { summarizeMaterialReturnsForGrn } = await import(
      '../src/modules/purchase/returns/returnable-quantity.service.js'
    )
    const stats = await summarizeMaterialReturnsForGrn(tenant.id, GRN_ID)
    console.log(`  returnable lines=${stats.byGrnLineId.size} entries=${stats.entries.length}`)
  })

  console.log('\nAll GET /purchase/grns/:id Prisma steps OK — if stage API still 500, redeploy Hostinger (stale runtime client).')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('\nProbe failed — fix the step above (SQL column/enum or prisma generate on Hostinger).')
  console.error(e)
  process.exit(1)
})
