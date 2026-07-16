import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query. Matches Tailwind/erp breakpoints
 * (e.g. `(max-width: 767px)`, `(min-width: 1280px)`).
 */
export function useMediaQuery(query: string, enabled = true): boolean {
  const [matches, setMatches] = useState(() => {
    if (!enabled || typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setMatches(false)
      return
    }
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query, enabled])

  return enabled && matches
}

/** Below Tailwind `md` (768px) — mobile card lines preferred. */
export const MQ_MOBILE = '(max-width: 767px)'

/** Below Tailwind `lg` (1024px) — collapse secondary command / toolbar actions. */
export const MQ_BELOW_LG = '(max-width: 1023px)'

/** Tailwind `xl` and up — FactBox open by default; register right-rail breakpoint. */
export const MQ_XL_UP = '(min-width: 1280px)'
