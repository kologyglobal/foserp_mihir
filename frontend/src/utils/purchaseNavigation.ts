export function purchaseBreadcrumbs(label: string, parent?: { label: string; to: string }) {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Home', to: '/home' },
    { label: 'Purchase', to: '/purchase' },
  ]
  if (parent) crumbs.push(parent)
  crumbs.push({ label })
  return crumbs
}

export function prListBreadcrumbs() {
  return purchaseBreadcrumbs('Requisitions')
}

export function prFormBreadcrumbs(isEdit: boolean, prNo?: string) {
  return purchaseBreadcrumbs(isEdit ? `Edit ${prNo ?? 'PR'}` : 'New Requisition', {
    label: 'Requisitions',
    to: '/purchase/requisitions',
  })
}

export function rfqListBreadcrumbs() {
  return purchaseBreadcrumbs('RFQs')
}

export function poListBreadcrumbs() {
  return purchaseBreadcrumbs('Purchase Orders')
}

export function approvalsListBreadcrumbs() {
  return purchaseBreadcrumbs('Approvals')
}

export function grnListBreadcrumbs() {
  return purchaseBreadcrumbs('GRN / Receipts')
}

export function reportsBreadcrumbs(label: string) {
  return purchaseBreadcrumbs(label, { label: 'Reports', to: '/purchase/reports' })
}

export function invoiceListBreadcrumbs() {
  return purchaseBreadcrumbs('Purchase Invoices')
}
