import type { ReactNode } from 'react'
import { ErpCardSection } from '../erp/card-form/ErpCardSection'
import { cn } from '../../utils/cn'

interface CrmLeadFormSectionProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  badge?: ReactNode
  step?: number
  optional?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
}

/** CRM lead FastTab — wraps shared ErpCardSection with legacy CSS hooks */
export function CrmLeadFormSection({ className, ...props }: CrmLeadFormSectionProps) {
  return <ErpCardSection {...props} className={cn('crm-lead-fasttab', className)} />
}
