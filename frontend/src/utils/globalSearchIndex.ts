import { searchablePages } from '../config/navigation'
import { bom360Path, resolveCompany360Path } from '../config/entity360Routes'
import { CRM_MASTERS_CATALOG } from '../config/crmMastersCatalog'
import { PRODUCT_INTEREST_MASTER_CATALOG, USER_MASTER_CATALOG } from '../config/globalMastersCatalog'
import { masterRegisterEntryPath } from './masterRegisterScope'
import type { BomHeader } from '../types/bom'
import type { CrmContact } from '../types/crm'
import type { CrmMasterEntry } from '../types/crmMasters'
import type {
  Customer,
  CustomerContact,
  Item,
  ItemCategory,
  Product,
  Transporter,
  Uom,
  Vendor,
  Warehouse,
  Location,
} from '../types/master'
import type { RoutingHeader } from '../types/routing'
import type { WorkCenter } from '../types/workcenter'
import type { GstGroupCode, GstRate, HsnMaster } from '../types/taxMaster'
import type { CodeSeries } from '../types/codeSeriesMaster'
import { panFromGstin } from './customerUtils'

export type GlobalSearchGroup = 'page' | 'master' | 'document'

export interface GlobalSearchHit {
  id: string
  type: string
  label: string
  sublabel: string
  href: string
  group: GlobalSearchGroup
}

interface GlobalSearchIndexEntry extends GlobalSearchHit {
  indexText: string
}

export interface MasterSearchSources {
  uoms: Uom[]
  categories: ItemCategory[]
  items: Item[]
  customers: Customer[]
  vendors: Vendor[]
  warehouses: Warehouse[]
  locations: Location[]
  products: Product[]
  customerContacts: CustomerContact[]
  transporters: Transporter[]
  bomHeaders: BomHeader[]
  workCenters: WorkCenter[]
  routingHeaders: RoutingHeader[]
  crmMasterEntries: CrmMasterEntry[]
  crmContacts: CrmContact[]
  hsnMasters?: HsnMaster[]
  gstGroups?: GstGroupCode[]
  gstRates?: GstRate[]
  codeSeries?: CodeSeries[]
}

export interface TransactionSearchSources {
  salesOrders: Array<{ id: string; salesOrderNo: string; status: string }>
  purchaseOrders: Array<{ id: string; poNo: string; status: string }>
  workOrders: Array<{ id: string; woNo: string; status: string; woType?: string }>
  jobCards: Array<{ id: string; jobCardNo: string; woNo: string }>
  subcontractShipments: Array<{ id: string; challanNo: string; workOrderId: string }>
  invoices: Array<{ id: string; invoiceNo: string; status: string }>
  grns: Array<{ id: string; grnNo: string; poNo: string }>
  qrRecords: Array<{ qrId: string; displayCode: string; qrCode: string; entityType: string }>
  serials: Array<{ id: string; serialNo: string; serialType: string }>
  ecos: Array<{ id: string; ecoNo: string; approvalStatus: string }>
}

export interface GlobalSearchSources {
  masters: MasterSearchSources
  transactions: TransactionSearchSources
}

const CRM_MASTER_TITLE_BY_KIND = {
  ...Object.fromEntries(CRM_MASTERS_CATALOG.map((item) => [item.kind, item.title])),
  owners: USER_MASTER_CATALOG.title,
  'product-interests': PRODUCT_INTEREST_MASTER_CATALOG.title,
} as Record<CrmMasterEntry['kind'], string>

function tokens(...parts: Array<string | number | undefined | null>): string {
  return parts
    .map((p) => String(p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
}

function pushEntry(out: GlobalSearchIndexEntry[], hit: GlobalSearchHit, indexParts: Array<string | number | undefined | null>) {
  out.push({ ...hit, indexText: tokens(...indexParts) })
}

export function buildPageSearchIndex(): GlobalSearchIndexEntry[] {
  const out: GlobalSearchIndexEntry[] = []
  for (const page of searchablePages) {
    pushEntry(
      out,
      {
        id: page.path,
        type: 'Page',
        label: page.label,
        sublabel: page.category,
        href: page.path,
        group: 'page',
      },
      [page.label, page.category, page.path],
    )
  }
  return out
}

export function buildMasterSearchIndex(
  sources: MasterSearchSources,
  pathname?: string | null,
): GlobalSearchIndexEntry[] {
  const out: GlobalSearchIndexEntry[] = []
  const customerNameById = Object.fromEntries(sources.customers.map((c) => [c.id, c.customerName]))
  const productNameById = Object.fromEntries(sources.products.map((p) => [p.id, p.productName]))

  for (const uom of sources.uoms) {
    pushEntry(
      out,
      {
        id: uom.id,
        type: 'UOM',
        label: uom.uomCode,
        sublabel: uom.uomName,
        href: `/masters/uom/${uom.id}`,
        group: 'master',
      },
      [uom.uomCode, uom.uomName, uom.uomType],
    )
  }

  for (const hsn of sources.hsnMasters ?? []) {
    pushEntry(
      out,
      {
        id: hsn.id,
        type: 'HSN',
        label: hsn.code,
        sublabel: hsn.description,
        href: `/masters/hsn/${hsn.id}`,
        group: 'master',
      },
      [hsn.code, hsn.description],
    )
  }

  for (const group of sources.gstGroups ?? []) {
    pushEntry(
      out,
      {
        id: group.id,
        type: 'GST Group',
        label: group.code,
        sublabel: group.description,
        href: `/masters/gst-groups/${group.id}`,
        group: 'master',
      },
      [group.code, group.description, group.goodsType],
    )
  }

  for (const rate of sources.gstRates ?? []) {
    pushEntry(
      out,
      {
        id: rate.id,
        type: 'GST Rate',
        label: `${rate.sgst + rate.cgst + rate.igst}%`,
        sublabel: `${rate.fromState} → ${rate.locationStateCode}`,
        href: `/masters/gst-rates/${rate.id}`,
        group: 'master',
      },
      [rate.fromState, rate.locationStateCode, rate.sgst, rate.cgst, rate.igst, rate.dateFrom],
    )
  }

  for (const category of sources.categories) {
    pushEntry(
      out,
      {
        id: category.id,
        type: 'Category',
        label: category.categoryCode,
        sublabel: category.categoryName,
        href: `/masters/item-categories/${category.id}`,
        group: 'master',
      },
      [category.categoryCode, category.categoryName],
    )
  }

  for (const item of sources.items) {
    pushEntry(
      out,
      {
        id: item.id,
        type: 'Item',
        label: item.itemCode,
        sublabel: item.itemName,
        href: `/masters/items/${item.id}`,
        group: 'master',
      },
      [item.itemCode, item.itemName, item.itemDescription, item.hsnCode, item.materialGrade, item.itemType],
    )
  }

  for (const customer of sources.customers) {
    const pan = customer.pan ?? panFromGstin(customer.gstin)
    pushEntry(
      out,
      {
        id: customer.id,
        type: 'Company',
        label: customer.customerCode,
        sublabel: customer.customerName,
        href: resolveCompany360Path(customer.id, pathname),
        group: 'master',
      },
      [
        customer.customerCode,
        customer.customerName,
        customer.gstin,
        pan,
        customer.city,
        customer.state,
        customer.pincode,
        customer.contactPerson,
        customer.contactEmail,
        customer.contactPhone,
        customer.industry,
        customer.addressLine1,
        customer.shippingAddress,
      ],
    )
    pushEntry(
      out,
      {
        id: `${customer.id}-360`,
        type: 'Company 360',
        label: `${customer.customerCode} 360`,
        sublabel: 'Company intelligence workspace',
        href: resolveCompany360Path(customer.id, pathname),
        group: 'master',
      },
      [customer.customerCode, customer.customerName, customer.gstin, pan, customer.city, '360'],
    )
  }

  for (const contact of sources.customerContacts) {
    const companyName = customerNameById[contact.customerId]
    pushEntry(
      out,
      {
        id: contact.id,
        type: 'Company Contact',
        label: contact.contactName,
        sublabel: companyName ? `${companyName} · ${contact.designation}` : contact.designation,
        href: resolveCompany360Path(contact.customerId, pathname),
        group: 'master',
      },
      [contact.contactName, contact.email, contact.mobile, contact.department, contact.designation, companyName],
    )
  }

  for (const vendor of sources.vendors) {
    pushEntry(
      out,
      {
        id: vendor.id,
        type: 'Vendor',
        label: vendor.vendorCode,
        sublabel: vendor.vendorName,
        href: `/masters/vendors/${vendor.id}`,
        group: 'master',
      },
      [vendor.vendorCode, vendor.vendorName, vendor.gstin, vendor.city, vendor.state, vendor.contactPerson, vendor.contactPhone],
    )
  }

  for (const warehouse of sources.warehouses) {
    pushEntry(
      out,
      {
        id: warehouse.id,
        type: 'Warehouse',
        label: warehouse.warehouseCode,
        sublabel: warehouse.warehouseName,
        href: `/masters/warehouses/${warehouse.id}`,
        group: 'master',
      },
      [warehouse.warehouseCode, warehouse.warehouseName, warehouse.warehouseType, warehouse.plantCode, warehouse.address],
    )
  }

  for (const loc of sources.locations ?? []) {
    pushEntry(
      out,
      {
        id: loc.id,
        type: 'Location',
        label: loc.locationCode,
        sublabel: loc.locationName,
        href: `/masters/locations/${loc.id}`,
        group: 'master',
      },
      [loc.locationCode, loc.locationName, loc.name2, loc.city, loc.state, loc.address],
    )
  }

  for (const product of sources.products) {
    pushEntry(
      out,
      {
        id: product.id,
        type: 'Product',
        label: product.productCode,
        sublabel: product.productName,
        href: `/masters/products/${product.id}`,
        group: 'master',
      },
      [product.productCode, product.productName, product.capacity, product.axleConfig, product.productFamily, product.productType],
    )
  }

  for (const bom of sources.bomHeaders) {
    const productName = productNameById[bom.productId]
    pushEntry(
      out,
      {
        id: bom.id,
        type: 'BOM',
        label: bom.bomNo,
        sublabel: `${bom.description} · Rev ${bom.revision}`,
        href: bom360Path(bom.id),
        group: 'master',
      },
      [bom.bomNo, bom.description, bom.revision, bom.status, productName],
    )
    pushEntry(
      out,
      {
        id: `${bom.id}-360`,
        type: 'BOM 360',
        label: `${bom.bomNo} 360`,
        sublabel: 'Engineering intelligence workspace',
        href: bom360Path(bom.id),
        group: 'master',
      },
      [bom.bomNo, bom.description, productName, '360'],
    )
  }

  for (const wc of sources.workCenters) {
    pushEntry(
      out,
      {
        id: wc.id,
        type: 'Work Center',
        label: wc.workCenterCode,
        sublabel: wc.workCenterName,
        href: `/masters/work-centers/${wc.id}`,
        group: 'master',
      },
      [wc.workCenterCode, wc.workCenterName, wc.department, wc.plantCode, wc.description],
    )
  }

  for (const routing of sources.routingHeaders) {
    const productName = productNameById[routing.productId]
    pushEntry(
      out,
      {
        id: routing.id,
        type: 'Routing',
        label: routing.routingNo,
        sublabel: productName ? `${productName} · Rev ${routing.revision}` : routing.description,
        href: `/masters/routing/${routing.id}`,
        group: 'master',
      },
      [routing.routingNo, routing.description, routing.revision, routing.status, productName],
    )
  }

  for (const transporter of sources.transporters) {
    pushEntry(
      out,
      {
        id: transporter.id,
        type: 'Transporter',
        label: transporter.transporterName,
        sublabel: transporter.city || transporter.vehicleType,
        href: '/masters',
        group: 'master',
      },
      [transporter.transporterName, transporter.contactPerson, transporter.mobile, transporter.gstin, transporter.city, transporter.vehicleType],
    )
  }

  for (const entry of sources.crmMasterEntries) {
    const masterTitle = CRM_MASTER_TITLE_BY_KIND[entry.kind] ?? entry.kind
    const typeLabel =
      entry.kind === 'owners'
        ? 'Employee'
        : entry.kind === 'payment-terms'
          ? 'Payment Term'
          : entry.kind === 'delivery-terms'
            ? 'Delivery Term'
            : entry.kind === 'warranty-terms'
              ? 'Warranty Term'
          : entry.kind === 'territories'
            ? 'Territory'
            : entry.kind === 'industries'
              ? 'Industry'
              : 'CRM Master'
    pushEntry(
      out,
      {
        id: entry.id,
        type: typeLabel,
        label: entry.code,
        sublabel: `${masterTitle} · ${entry.name}`,
        href: masterRegisterEntryPath(entry.kind, entry.id),
        group: 'master',
      },
      [entry.code, entry.name, entry.description, entry.notes, masterTitle, entry.kind],
    )
  }

  for (const contact of sources.crmContacts) {
    const companyName = customerNameById[contact.customerId]
    pushEntry(
      out,
      {
        id: contact.id,
        type: 'Contact',
        label: contact.name,
        sublabel: companyName ? `${companyName} · ${contact.designation}` : contact.designation,
        href: `/masters/contacts/${contact.id}`,
        group: 'master',
      },
      [contact.name, contact.email, contact.phone, contact.designation, companyName],
    )
  }

  for (const series of sources.codeSeries ?? []) {
    pushEntry(
      out,
      {
        id: series.id,
        type: 'Code Series',
        label: series.seriesCode,
        sublabel: `${series.entityType} · ${series.description ?? series.prefix}`,
        href: `/masters/code-series/${series.id}`,
        group: 'master',
      },
      [series.seriesCode, series.seriesName, series.entityType, series.prefix, series.description, series.module],
    )
  }

  return out
}

export function buildTransactionSearchIndex(sources: TransactionSearchSources): GlobalSearchIndexEntry[] {
  const out: GlobalSearchIndexEntry[] = []

  for (const so of sources.salesOrders ?? []) {
    pushEntry(
      out,
      { id: so.id, type: 'SO', label: so.salesOrderNo, sublabel: so.status, href: `/sales/orders/${so.id}`, group: 'document' },
      [so.salesOrderNo, so.status],
    )
  }

  for (const po of sources.purchaseOrders ?? []) {
    pushEntry(
      out,
      { id: po.id, type: 'PO', label: po.poNo, sublabel: po.status, href: `/purchase/orders/${po.id}`, group: 'document' },
      [po.poNo, po.status],
    )
  }

  for (const wo of sources.workOrders ?? []) {
    pushEntry(
      out,
      { id: wo.id, type: 'WO', label: wo.woNo, sublabel: wo.status, href: `/manufacturing/work-orders/${wo.id}`, group: 'document' },
      [wo.woNo, wo.status],
    )
    pushEntry(
      out,
      {
        id: `${wo.id}-360`,
        type: 'WO 360',
        label: `${wo.woNo} 360`,
        sublabel: 'Operational workspace',
        href: `/manufacturing/work-orders/${wo.id}`,
        group: 'document',
      },
      [wo.woNo, wo.status, '360'],
    )
    if (wo.woType === 'subcontract') {
      const jwoNo = `JWO-${wo.woNo}`
      pushEntry(
        out,
        { id: wo.id, type: 'JWO', label: jwoNo, sublabel: wo.status, href: `/manufacturing/job-work`, group: 'document' },
        [jwoNo, wo.woNo, wo.status],
      )
    }
  }

  for (const jc of sources.jobCards ?? []) {
    pushEntry(
      out,
      {
        id: jc.id,
        type: 'Job Card',
        label: jc.jobCardNo,
        sublabel: jc.woNo,
        href: '/manufacturing/work-orders',
        group: 'document',
      },
      [jc.jobCardNo, jc.woNo],
    )
  }

  for (const sh of sources.subcontractShipments ?? []) {
    pushEntry(
      out,
      {
        id: sh.id,
        type: 'Challan',
        label: sh.challanNo,
        sublabel: 'Job work challan',
        href: `/manufacturing/job-work`,
        group: 'document',
      },
      [sh.challanNo],
    )
  }

  for (const inv of sources.invoices ?? []) {
    pushEntry(
      out,
      { id: inv.id, type: 'Invoice', label: inv.invoiceNo, sublabel: inv.status, href: `/accounting/money-in/invoices/${inv.id}`, group: 'document' },
      [inv.invoiceNo, inv.status],
    )
  }

  for (const grn of sources.grns ?? []) {
    pushEntry(
      out,
      { id: grn.id, type: 'GRN', label: grn.grnNo, sublabel: grn.poNo, href: `/purchase/grn/${grn.id}`, group: 'document' },
      [grn.grnNo, grn.poNo],
    )
  }

  for (const qr of sources.qrRecords ?? []) {
    pushEntry(
      out,
      { id: qr.qrId, type: 'QR', label: qr.displayCode, sublabel: qr.entityType, href: `/manufacturing/traceability`, group: 'document' },
      [qr.displayCode, qr.qrCode, qr.entityType],
    )
  }

  for (const sn of sources.serials ?? []) {
    pushEntry(
      out,
      { id: sn.id, type: 'Serial', label: sn.serialNo, sublabel: sn.serialType, href: `/manufacturing/traceability`, group: 'document' },
      [sn.serialNo, sn.serialType],
    )
  }

  for (const eco of sources.ecos ?? []) {
    pushEntry(
      out,
      { id: eco.id, type: 'ECO', label: eco.ecoNo, sublabel: eco.approvalStatus, href: `/manufacturing/setup/boms`, group: 'document' },
      [eco.ecoNo, eco.approvalStatus],
    )
  }

  return out
}

export function buildGlobalSearchIndex(
  sources: GlobalSearchSources,
  pathname?: string | null,
): GlobalSearchIndexEntry[] {
  return [
    ...buildPageSearchIndex(),
    ...buildMasterSearchIndex(sources.masters, pathname),
    ...buildTransactionSearchIndex(sources.transactions),
  ]
}

export function searchGlobalIndex(entries: GlobalSearchIndexEntry[], query: string, limit = 20): GlobalSearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return entries.filter((entry) => entry.indexText.includes(q)).slice(0, limit).map(({ indexText: _indexText, ...hit }) => hit)
}

export function runGlobalSearch(
  query: string,
  sources: GlobalSearchSources,
  limit = 20,
  pathname?: string | null,
): GlobalSearchHit[] {
  return searchGlobalIndex(buildGlobalSearchIndex(sources, pathname), query, limit)
}
