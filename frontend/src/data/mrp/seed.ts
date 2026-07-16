import type { SalesOrder } from '../../types/mrp'
import { enrichAnchorSalesOrder } from '../demo/crmSalesOrderLinkage'

const ts = new Date().toISOString()

/** Delivery date = today + 30 days for anchor simulation order */
const delivery30Days = () => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

/** Trailer manufacturing sales orders */
export const seedSalesOrders: SalesOrder[] = [
  enrichAnchorSalesOrder({
    id: 'so-0001',
    salesOrderNo: 'SO-0001',
    customerId: 'cust-abc',
    productId: 'prod-45m3',
    qty: 2,
    requiredDate: delivery30Days(),
    status: 'confirmed',
    remarks: 'ABC Cement — 2× 45 M3 Bulker Trailer · 30-day delivery',
    createdAt: ts,
    orderDate: ts.slice(0, 10),
    unitPrice: 2850000,
    basicAmount: 5700000,
    gstAmount: 1026000,
    grandTotal: 6726000,
    paymentTerms: '30 days from dispatch',
    deliveryTerms: 'Ex-works Pune',
    warrantyTerms: '12 months manufacturing defect',
    customerPoNumber: 'ABC/PO/2026/014',
    deliveryLocation: 'ABC Cement, Hadapsar, Pune',
  }),
  {
    id: 'so-0142',
    salesOrderNo: 'SO-2026-0142',
    customerId: 'cust-utcl',
    productId: 'prod-45m3',
    qty: 1,
    requiredDate: '2026-08-15',
    status: 'confirmed',
    remarks: 'UltraTech Cement — follow-on bulker order',
    createdAt: ts,
  },
  {
    id: 'so-0180',
    salesOrderNo: 'SO-2026-0180',
    customerId: 'cust-ioc',
    productId: 'prod-iso',
    qty: 1,
    requiredDate: '2026-09-01',
    status: 'open',
    remarks: 'Indian Oil — 26 KL ISO Tank (BOM not yet released)',
    createdAt: ts,
    source: 'direct',
    directSoReason: 'Repeat customer PO — engineering release pending for ISO tank BOM',
  },
  {
    id: 'so-0192',
    salesOrderNo: 'SO-2026-0192',
    customerId: 'cust-dalmia',
    productId: 'prod-sidewall',
    qty: 3,
    requiredDate: '2026-10-15',
    status: 'open',
    remarks: 'Dalmia Bharat — 3× 32 FT Side Wall trailers',
    createdAt: ts,
  },
]
