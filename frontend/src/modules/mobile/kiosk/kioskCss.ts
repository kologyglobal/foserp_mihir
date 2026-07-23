import { cn } from '@/utils/cn'

/** Extra-large touch targets for tablet / wall kiosk on the shop floor. */
export const kioskTileClass = cn(
  'flex min-h-[9rem] flex-col items-start justify-between rounded-2xl border border-[#edebe9] bg-white p-5 text-left shadow-sm',
  'active:scale-[0.99] transition',
)

export const kioskPrimaryBtn = cn(
  'inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-4',
  'text-lg font-bold bg-[#0078d4] text-white active:bg-[#106ebe]',
)

export const kioskSecondaryBtn = cn(
  'inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-4',
  'text-lg font-bold border border-[#edebe9] bg-white text-[#242424] active:bg-[#f3f2f1]',
)

export const kioskDangerBtn = cn(
  'inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-4',
  'text-lg font-bold border border-rose-200 bg-rose-50 text-rose-900 active:bg-rose-100',
)

export const kioskWarnBtn = cn(
  'inline-flex min-h-14 w-full items-center justify-center rounded-xl px-4 py-4',
  'text-lg font-bold border border-amber-200 bg-amber-50 text-amber-950 active:bg-amber-100',
)

export const kioskCardClass =
  'rounded-2xl border border-[#edebe9] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
