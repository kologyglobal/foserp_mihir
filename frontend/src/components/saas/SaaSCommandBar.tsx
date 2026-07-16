import type { ReactNode } from 'react'

export function SaaSCommandBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-[var(--erp-topbar-height)] z-10 flex flex-wrap items-center gap-2 border-b border-[var(--saas-border)] bg-[var(--saas-surface)]/95 px-4 py-2 backdrop-blur-sm">
      {children}
    </div>
  )
}
