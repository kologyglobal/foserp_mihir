import { cn } from '@/utils/cn'

/** Minimum 48px touch target for shop-floor operator actions. */
export const operatorBtnClass = cn(
  'inline-flex min-h-12 min-w-[7rem] items-center justify-center rounded-lg px-4 py-3',
  'text-[15px] font-semibold transition active:scale-[0.98]',
)

export const operatorBtnPrimary = cn(operatorBtnClass, 'bg-erp-primary text-white hover:bg-erp-primary/90')
export const operatorBtnSecondary = cn(
  operatorBtnClass,
  'border border-erp-border bg-white text-erp-text hover:bg-erp-surface-alt',
)
export const operatorBtnDanger = cn(operatorBtnClass, 'border border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100')
export const operatorBtnWarning = cn(
  operatorBtnClass,
  'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
)

export const operatorCardClass =
  'rounded-lg border border-erp-border bg-white p-4 shadow-[var(--erp-shadow-card,0_1px_2px_rgba(0,0,0,0.04))]'
