/**
 * Smoke: purchase reports catalog + one register run.
 * Run: npx tsx scripts/smoke-purchase-reports.ts
 */
import {
  getPurchaseReportCatalog,
  runPurchaseReport,
} from '../src/services/purchase/purchaseReportsService'
import { resetPurchaseMockData } from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const catalog = getPurchaseReportCatalog()
  const reportCount = catalog.reduce((n, g) => n + g.reports.length, 0)
  console.log(
    'catalog',
    catalog.map((g) => ({ id: g.id, count: g.reports.length })),
    'total',
    reportCount,
  )

  if (reportCount < 30) {
    console.error('FAIL: expected at least 30 reports, got', reportCount)
    process.exit(1)
  }

  const result = await runPurchaseReport('pr-register', {})
  console.log('pr-register', {
    title: result.title,
    rows: result.rows.length,
    columns: result.columns.map((c) => c.key),
    summary: result.summary,
  })

  if (result.rows.length === 0) {
    console.error('FAIL: PR register returned no rows')
    process.exit(1)
  }

  const placeholder = await runPurchaseReport('inv-vendor-outstanding', {})
  if (!placeholder.isPlaceholder) {
    console.error('FAIL: expected placeholder for vendor outstanding')
    process.exit(1)
  }
  console.log('placeholder ok', placeholder.placeholderMessage)

  const po = await runPurchaseReport('po-register', {})
  console.log('po-register rows', po.rows.length)

  console.log('OK smoke-purchase-reports')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
