import type { ReactNode } from 'react'

/** CRM-style horizontal essentials strip (replaces BC ErpDocEssentialsStrip) */
export function ErpCardFormEssentialsStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
      {children}
    </div>
  )
}

export function ErpCardFormEssentialField({
  label,
  children,
  required,
}: {
  label: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      <span className="text-sm font-medium text-[#344054]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <div className="min-h-[40px]">{children}</div>
    </label>
  )
}

/** @deprecated Use ErpCardFormEssentialsStrip — CRM card form equivalent */
export const ErpDocEssentialsStrip = ErpCardFormEssentialsStrip

/** @deprecated Use ErpCardFormEssentialField — CRM card form equivalent */
export const ErpDocEssentialField = ErpCardFormEssentialField
