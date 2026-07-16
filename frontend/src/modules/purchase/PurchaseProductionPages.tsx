import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { buildPoPrintContext, downloadPoExcel, downloadPoPdf } from '../../utils/purchaseOrderExport'
import { PoPrintView } from '../../components/purchase/PurchaseOrderPrintDocument'

import { GrnDocumentPage } from './PurchaseDocumentPages'
export { GrnRegisterPage } from './GrnPages'

/** @deprecated Prefer PurchaseReportsHubPage — kept as alias for any deep imports. */
export { PurchaseReportsHubPage as PurchaseReportsPage } from './PurchaseReportsHubPage'

export function GrnDetailPage() {
  return <GrnDocumentPage />
}

export function PoPrintPage() {
  const { id } = useParams()
  const po = usePurchaseStore((s) => (id ? s.purchaseOrders.find((p) => p.id === id) : undefined))
  const getVendor = useMasterStore((s) => s.getVendor)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)

  const printContext = useMemo(() => {
    if (!po) return null
    const sourcePr = po.prId ? usePurchaseStore.getState().getPr(po.prId) : undefined
    const sourceRfq = po.rfqId ? usePurchaseStore.getState().getRfq(po.rfqId) : undefined
    return buildPoPrintContext({
      po,
      vendor: getVendor(po.vendorId),
      sourcePrNo: sourcePr?.prNo,
      sourceRfqNo: sourceRfq?.rfqNo,
      getItem,
      getWarehouse,
      getUomCode: (itemId) => {
        const item = items.find((i) => i.id === itemId)
        return uoms.find((u) => u.id === item?.baseUomId)?.uomCode ?? 'Nos'
      },
    })
  }, [po, getVendor, getItem, getWarehouse, items, uoms])

  if (!id) return null

  if (!po) {
    return (
      <div className="erp-page p-6">
        <p className="text-sm text-erp-muted">Purchase order not found.</p>
        <Link to="/purchase/orders" className="mt-3 inline-flex text-sm text-erp-primary">
          Back to PO list
        </Link>
      </div>
    )
  }

  return (
    <div className="erp-page space-y-4 p-4 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ErpButtonGroup>
          <Link to={`/purchase/orders/${id}`}>
            <ErpButton type="button" variant="secondary" icon={ArrowLeft}>
              Back
            </ErpButton>
          </Link>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print
          </ErpButton>
          {printContext ? (
            <>
              <ErpButton
                type="button"
                variant="secondary"
                icon={Download}
                onClick={() => downloadPoPdf(printContext)}
              >
                PDF
              </ErpButton>
              <ErpButton
                type="button"
                variant="secondary"
                icon={FileSpreadsheet}
                onClick={() => downloadPoExcel(printContext)}
              >
                Excel
              </ErpButton>
            </>
          ) : null}
        </ErpButtonGroup>
      </div>
      <PoPrintView poId={id} />
    </div>
  )
}
