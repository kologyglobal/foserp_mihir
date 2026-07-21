import { cn } from '../../utils/cn'

export type LoaderSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<LoaderSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

const RING_BORDER: Record<LoaderSize, string> = {
  sm: 'border-2',
  md: 'border-[3px]',
  lg: 'border-[3px]',
  xl: 'border-4',
}

interface LoaderProps {
  size?: LoaderSize
  /** Center in the full viewport (app boot / route-level loading). */
  fullScreen?: boolean
  /** Accessible name only — never rendered as visible text. */
  label?: string
  className?: string
}

/**
 * Main app loader — theme-driven dual-ring spinner (erp-primary + erp-accent), no text.
 * Use everywhere a loading state is needed; prefer this over one-off spinners.
 */
export function Loader({ size = 'md', fullScreen = false, label = 'Loading', className }: LoaderProps) {
  const spinner = (
    <span
      className={cn('relative inline-block', SIZE_CLASSES[size], className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Outer ring — brand primary, clockwise */}
      <span
        className={cn(
          'absolute inset-0 animate-spin rounded-full border-transparent',
          'border-t-erp-primary border-r-erp-primary',
          RING_BORDER[size],
        )}
        aria-hidden
      />
      {/* Inner ring — accent, counter-clockwise */}
      <span
        className={cn(
          'absolute inset-[22%] animate-spin rounded-full border-transparent',
          'border-b-erp-accent border-l-erp-accent',
          '[animation-direction:reverse] [animation-duration:0.7s]',
          RING_BORDER[size],
        )}
        aria-hidden
      />
      {/* Center pulse dot */}
      <span
        className="absolute inset-[42%] animate-pulse rounded-full bg-erp-primary/60"
        aria-hidden
      />
    </span>
  )

  if (!fullScreen) return spinner

  return (
    <div className="flex min-h-screen items-center justify-center bg-erp-bg">
      {spinner}
    </div>
  )
}
