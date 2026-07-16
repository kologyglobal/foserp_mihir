import { useDmsStore } from '../../store/dmsStore'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

/** Upload documents linked to products, WOs, and customers */
export function seedDemoDocuments(): void {
  const dms = useDmsStore.getState()
  const products = useMasterStore.getState().products
  const customers = useMasterStore.getState().customers
  const wos = useWorkOrderStore.getState().workOrders

  while (useDmsStore.getState().documents.length < SATURATION_TARGETS.documents) {
    const n = useDmsStore.getState().documents.length
    const kind = n % 3
    if (kind === 0) {
      const p = products[n % products.length]
      dms.uploadDocument({
        title: `Engineering Drawing — ${p.productName}`,
        fileName: `dwg-sat-${n + 1}.pdf`,
        category: 'engineering_drawing',
        fileContent: 'data:application/pdf;base64,VUFE',
        entityLinks: [{ entityType: 'product', entityId: p.id, entityLabel: p.productName }],
      })
    } else if (kind === 1) {
      const wo = wos[n % Math.max(wos.length, 1)]
      if (wo) {
        dms.uploadDocument({
          title: `WO Traveler — ${wo.woNo}`,
          fileName: `wo-doc-${n + 1}.pdf`,
          category: 'qc_report',
          fileContent: 'data:application/pdf;base64,VUFE',
          entityLinks: [{ entityType: 'work_order', entityId: wo.id, entityLabel: wo.woNo }],
        })
      }
    } else {
      const c = customers[n % customers.length]
      dms.uploadDocument({
        title: `Customer PO Copy — ${c.customerName}`,
        fileName: `cust-po-${n + 1}.pdf`,
        category: 'sales_attachment',
        fileContent: 'data:application/pdf;base64,VUFE',
        entityLinks: [{ entityType: 'customer', entityId: c.id, entityLabel: c.customerName }],
      })
    }
  }
}
