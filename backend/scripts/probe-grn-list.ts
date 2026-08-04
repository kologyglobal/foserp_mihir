/**
 * Probe GRN list query against live/stage DB (run from PC with DB_* env set).
 * Usage:
 *   $env:DB_HOST="srv1491.hstgr.io"; ... ; npx tsx scripts/probe-grn-list.ts vasant-trailers
 */
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config()

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

process.env.DATABASE_URL = buildDatabaseUrl()

const tenantSlug = process.argv[2] ?? 'vasant-trailers'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } })
  if (!tenant) {
    console.error('Tenant not found:', tenantSlug)
    process.exit(1)
  }
  console.log('Tenant:', tenant.id, tenant.slug)

  const legacy = await prisma.$queryRaw<
    Array<{ toleranceStatus_raw: string; cnt: bigint }>
  >`
    SELECT CAST(toleranceStatus AS CHAR(64)) AS toleranceStatus_raw, COUNT(*) AS cnt
    FROM goods_receipt_lines
    WHERE CAST(toleranceStatus AS CHAR(64)) NOT IN (
      'NOT_RECEIVED','PARTIAL','EXACT','EXCESS_WITHIN_TOLERANCE','EXCESS_OUTSIDE_TOLERANCE'
    )
    GROUP BY CAST(toleranceStatus AS CHAR(64))
  `
  console.log('Legacy toleranceStatus rows:', legacy)

  try {
    const [items, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where: { tenantId: tenant.id, deletedAt: null },
        take: 5,
        orderBy: { receiptDate: 'desc' },
        include: {
          lines: { orderBy: { lineNumber: 'asc' } },
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
        },
      }),
      prisma.goodsReceipt.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    ])
    console.log('GRN list OK — total:', total, 'sample:', items.map((g) => g.grnNumber))
  } catch (e) {
    console.error('GRN list FAILED (same error as stage API):')
    console.error(e)
    process.exit(1)
  }
}

main()
  .finally(() => prisma.$disconnect())
