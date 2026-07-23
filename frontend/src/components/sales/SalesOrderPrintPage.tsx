import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { SalesOrderPrintDocument } from './SalesOrderPrintDocument'
import {
  isCrmPath,
  resolveSalesOrderDetailPath,
} from '../../utils/crmSalesOrderNavigation'

export function SalesOrderPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const crmMode = isCrmPath(pathname)
  const order = useMrpStore((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))
  const customer = useMasterStore((s) =>
    order ? s.customers.find((c) => c.id === order.customerId) : undefined,
  )
  const product = useMasterStore((s) =>
    order ? s.products.find((p) => p.id === order.productId) : undefined,
  )

  if (!order) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Sales order not found.</p>
        <Link
          to={crmMode ? '/crm/sales-orders' : '/sales/orders'}
          className="text-sm font-semibold text-erp-primary hover:underline"
        >
          Back to sales orders
        </Link>
      </div>
    )
  }

  const detailPath = resolveSalesOrderDetailPath(order.id, crmMode)

  return (
    <DocumentPrintShell
      title={order.salesOrderNo}
      subtitle="Sales order — print-ready / Save as PDF"
      backLabel="Back to order"
      onBack={() => navigate(detailPath)}
    >
      <SalesOrderPrintDocument order={order} customer={customer} product={product} />
    </DocumentPrintShell>
  )
}
