import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { SalesOrderPrintDocument } from './SalesOrderPrintDocument'
import {
  isCrmPath,
  resolveSalesOrderDetailPath,
} from '../../utils/crmSalesOrderNavigation'
import { isApiMode } from '../../config/apiConfig'
import {
  downloadSalesOrderPdf,
  printSalesOrderDocument,
  salesOrderPdfFileName,
} from '../../utils/salesOrderPdfExport'
import { PageLoadingFallback } from '../system/PageLoadingFallback'
import { notify } from '../../store/toastStore'

export function SalesOrderPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const crmMode = isCrmPath(pathname)
  const orderFromStore = useMrpStore((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => Boolean(id && !orderFromStore && isApiMode()))
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    if (orderFromStore) {
      setLoading(false)
      setLoadError(null)
      return
    }
    if (!isApiMode()) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void import('../../services/bridges/salesOrderApiBridge')
      .then((m) => m.apiFetchSalesOrder(id))
      .then((r) => {
        if (cancelled) return
        if (!r.ok) setLoadError(r.error ?? 'Could not load sales order')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load sales order')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, orderFromStore])

  const order = useMrpStore((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))
  const customer = useMasterStore((s) =>
    order ? s.customers.find((c) => c.id === order.customerId) : undefined,
  )
  const resolvedCustomerName = order?.customerName?.trim() || customer?.customerName
  const customerForPrint =
    customer ??
    (order && resolvedCustomerName
      ? ({
          id: order.customerId,
          customerName: resolvedCustomerName,
          customerCode: order.customerCode ?? '',
        } as NonNullable<typeof customer>)
      : undefined)
  const product = useMasterStore((s) =>
    order ? s.products.find((p) => p.id === order.productId) : undefined,
  )
  const products = useMasterStore((s) => s.products)
  const locations = useMasterStore((s) => s.locations)
  const fileName = order ? salesOrderPdfFileName(order.salesOrderNo) : 'SalesOrder.pdf'

  async function handleDownloadPdf() {
    if (!order || downloading) return
    setDownloading(true)
    notify.info('Preparing PDF…')
    const result = await downloadSalesOrderPdf({ fileName })
    setDownloading(false)
    if (result.ok) notify.success(`Downloaded ${result.fileName}`)
    else notify.error(result.error)
  }

  useEffect(() => {
    if (!order) return
    const autoDownload = searchParams.get('download') === '1' || searchParams.get('autodownload') === '1'
    const autoPrint = searchParams.get('autoprint') === '1'
    if (!autoDownload && !autoPrint) return

    const timer = window.setTimeout(() => {
      if (autoDownload) {
        void (async () => {
          notify.info('Preparing PDF…')
          const result = await downloadSalesOrderPdf({
            fileName: salesOrderPdfFileName(order.salesOrderNo),
          })
          if (result.ok) notify.success(`Downloaded ${result.fileName}`)
          else notify.error(result.error)
        })()
      } else {
        printSalesOrderDocument({ fileName: salesOrderPdfFileName(order.salesOrderNo) })
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [order, searchParams])

  if (loading) {
    return <PageLoadingFallback label="Loading sales order…" />
  }

  if (!order) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">{loadError ?? 'Sales order not found.'}</p>
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
    <div className="so-print-page erp-page">
      <div className="so-print-toolbar no-print">
        <div>
          <p className="so-print-toolbar__title">{order.salesOrderNo}</p>
          <p className="so-print-toolbar__subtitle">Sales order — document preview &amp; print</p>
        </div>
        <ErpButtonGroup>
          <ErpButton
            type="button"
            variant="primary"
            icon={Printer}
            onClick={() => printSalesOrderDocument({ fileName })}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            {downloading ? 'Preparing…' : 'Download PDF'}
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

      <div className="so-print-stage">
        <SalesOrderPrintDocument
          order={order}
          customer={customerForPrint}
          product={product}
          products={products}
          locations={locations}
        />
      </div>
    </div>
  )
}
