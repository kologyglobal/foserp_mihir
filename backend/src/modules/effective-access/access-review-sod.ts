/** Soft SoD hints for access review — not hard blocks. */
export const SOD_SELF_APPROVAL_HINTS: { label: string; create: string[]; approve: string[] }[] = [
  {
    label: 'May create and approve purchase documents (self-approval risk)',
    create: ['purchase.po.create', 'purchase.pr.create'],
    approve: ['purchase.po.approve', 'purchase.pr.approve'],
  },
  {
    label: 'May create and post invoices (self-approval risk)',
    create: ['invoice.create', 'commercial.invoice.create'],
    approve: ['invoice.post', 'commercial.invoice.post'],
  },
  {
    label: 'May create and approve stock adjustments',
    create: ['inventory.adjustment.create'],
    approve: ['inventory.adjustment.approve'],
  },
]
