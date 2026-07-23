import { Info } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Information banner spelling out gate business boundaries (no stock / accounting / attendance posting). */
export function GateBoundaryBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900',
        className,
      )}
      role="note"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
      <p>{message}</p>
    </div>
  )
}
