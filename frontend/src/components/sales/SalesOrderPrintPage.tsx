import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
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
    <div className="po-print-page erp-page">
      <div className="po-print-toolbar no-print">
        <div>
          <p className="po-print-toolbar__title">{order.salesOrderNo}</p>
          <p className="po-print-toolbar__subtitle">Sales order — print-ready / PDF preview</p>
        </div>
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Download} onClick={() => window.print()}>
            Download PDF
          </ErpButton>
          <ErpButton
            type="button"
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate(detailPath)}
          >
            Back to order
          </ErpButton>
        </ErpButtonGroup>
      </div>

      <SalesOrderPrintDocument order={order} customer={customer} product={product} />
    </div>
  )
}
