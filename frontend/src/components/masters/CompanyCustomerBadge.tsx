import type { Customer } from '../../types/master'
import { companyIsCustomer } from '../../utils/companyLabels'
import { cn } from '../../utils/cn'

export function CompanyCustomerBadge({
  company,
  className,
}: {
  company: Customer
  className?: string
}) {
  const isCustomer = companyIsCustomer(company)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isCustomer
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-100 text-slate-600',
        className,
      )}
    >
      {isCustomer ? 'Customer' : 'Company'}
    </span>
  )
}
