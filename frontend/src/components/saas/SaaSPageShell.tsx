import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function SaaSPageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('saas-page mx-auto max-w-[1600px] space-y-5 pb-10', className)}>
      {children}
    </div>
  )
}
