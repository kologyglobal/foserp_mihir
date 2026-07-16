export type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export const MFG_ACCOUNTING_BREADCRUMB = [
  { label: 'Accounting', to: '/accounting' },
  { label: 'Manufacturing Accounting', to: '/accounting/manufacturing' },
] as const

export const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
export const labelCls = 'block text-[12px] font-medium text-erp-text'
export const selectCls =
  'mt-0.5 block h-9 min-w-[140px] rounded-md border border-erp-border px-2 text-[12px]'
