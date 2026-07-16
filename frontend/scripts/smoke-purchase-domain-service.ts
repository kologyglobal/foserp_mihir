import {
  getPurchaseDashboard,
  resetPurchaseMockData,
} from '../src/services/purchase/purchaseService'

async function main() {
  await resetPurchaseMockData()
  const dashboard = await getPurchaseDashboard({
    dateFrom: '2026-06-01',
    dateTo: '2026-07-31',
  })
  console.log(
    JSON.stringify(
      {
        kpis: dashboard.kpis,
        pendingActions: dashboard.pendingActions.map((a) => ({ type: a.type, count: a.count })),
        deliveries: dashboard.upcomingDeliveries.length,
        trendMonths: dashboard.monthlyTrend.length,
        categories: dashboard.byCategory.map((c) => c.label),
        topVendors: dashboard.topVendors.map((v) => v.vendorName),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
