import type { SalesOrder } from '../../types/mrp'
import { seedSalesOrders } from '../mrp/seed'
import { DEMO_CUSTOMER_NAMES, SATURATION_TARGETS, SO_STATUS_DISTRIBUTION } from '../../demo/seeds/demoSeedCatalog'
import { enrichAnchorSalesOrder, enrichDemoMrpSalesOrder } from './crmSalesOrderLinkage'

const ts = new Date().toISOString()

function deliveryOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const CUSTOMER_IDS = [
  'cust-abc', 'cust-ultrabuild', 'cust-shree', 'cust-patel', 'cust-metro',
  'cust-national', 'cust-western', 'cust-raj', 'cust-sunrise', 'cust-utcl',
  'cust-ambuja', 'cust-ioc', 'cust-dalmia', 'cust-jsw', 'cust-acc',
] as const

const PRODUCT_IDS = [
  'prod-45m3', 'prod-iso', 'prod-sidewall', 'prod-cement-bulker', 'prod-tipping',
  'prod-flyash', 'prod-pneumatic', 'prod-lowbed', 'prod-flatbed', 'prod-ss-tank',
  'prod-tanker-30kl', 'prod-bulk-50m3', 'prod-container-40ft', 'prod-dumper-25t',
] as const

function buildStatusList(): SalesOrder['status'][] {
  const list: SalesOrder['status'][] = []
  for (const { status, count } of SO_STATUS_DISTRIBUTION) {
    for (let i = 0; i < count; i++) list.push(status as SalesOrder['status'])
  }
  while (list.length < SATURATION_TARGETS.salesOrders) list.push('confirmed')
  return list.slice(0, SATURATION_TARGETS.salesOrders)
}

/** 30 interconnected sales orders — preserves anchor SO-0001 from seed */
export function buildDemoMrpSalesOrders(): SalesOrder[] {
  const anchor = enrichAnchorSalesOrder(seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!)
  const statuses = buildStatusList()
  const extras: SalesOrder[] = []

  for (let i = 0; i < SATURATION_TARGETS.salesOrders; i++) {
    const n = i + 1
    const pad = String(n).padStart(4, '0')
    const customerId = CUSTOMER_IDS[i % CUSTOMER_IDS.length]
    const productId = PRODUCT_IDS[i % PRODUCT_IDS.length]
    const status = statuses[i] ?? 'confirmed'
    const qty = 1 + (i % 5)
    const unitPrice = 1900000 + i * 80000
    extras.push(
      enrichDemoMrpSalesOrder(
        {
          id: `so-demo-${String(n).padStart(3, '0')}`,
          salesOrderNo: `SO-2026-${pad}`,
          customerId,
          productId,
          qty,
          requiredDate: deliveryOffset(15 + (i % 60)),
          status,
          remarks: `${DEMO_CUSTOMER_NAMES[i % DEMO_CUSTOMER_NAMES.length]} — ${qty}× order · ${status.replace('_', ' ')}`,
          createdAt: ts,
          unitPrice,
          grandTotal: Math.round(unitPrice * qty * 1.18),
        },
        i,
      ),
    )
  }

  const legacy = seedSalesOrders.filter((s) => s.salesOrderNo !== 'SO-0001')
  return [{ ...anchor, status: 'confirmed' }, ...extras, ...legacy.map((s) => ({ ...s }))]
}
