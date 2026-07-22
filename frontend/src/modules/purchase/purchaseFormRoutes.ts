/** Registered Purchase routes used by create/edit form navigation. */
export const PURCHASE_FORM_ROUTES = {
  requisition: {
    list: '/purchase/requisitions',
    create: '/purchase/requisitions/new',
    edit: (id: string) => `/purchase/requisitions/${id}/edit`,
  },
  planning: {
    list: '/purchase/planning-sheet',
    create: null,
    edit: null,
  },
  rfq: {
    list: '/purchase/rfqs',
    create: '/purchase/rfqs/new',
    edit: (id: string) => `/purchase/rfqs/${id}/edit`,
  },
  vendorQuotation: {
    list: '/purchase/vendor-quotations',
    create: '/purchase/vendor-quotations/new',
    edit: (id: string) => `/purchase/vendor-quotations/${id}/edit`,
  },
  comparison: {
    list: '/purchase/comparison',
    create: null,
    edit: null,
  },
  purchaseOrder: {
    list: '/purchase/orders',
    create: '/purchase/orders/new',
    edit: (id: string) => `/purchase/orders/${id}/edit`,
  },
  grn: {
    list: '/purchase/grn',
    create: '/purchase/grn/new',
    edit: (id: string) => `/purchase/grn/${id}/edit`,
  },
  qualityInspection: {
    list: '/purchase/quality-inspections',
    create: '/purchase/quality-inspections/new',
    edit: null,
  },
  purchaseReturn: {
    list: '/purchase/returns',
    create: '/purchase/returns/new',
    edit: (id: string) => `/purchase/returns/${id}/edit`,
  },
  purchaseInvoice: {
    list: '/purchase/invoices',
    create: '/purchase/invoices/new',
    edit: (id: string) => `/purchase/invoices/${id}/edit`,
  },
  setup: {
    list: '/purchase/setup',
    create: null,
    edit: null,
  },
} as const
