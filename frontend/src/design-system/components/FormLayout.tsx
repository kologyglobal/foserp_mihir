import type { ReactNode } from 'react'
import { SectionCard } from '../../components/ui/SectionCard'
import { SectionHeader } from './SectionHeader'

export interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}

/** Standard two-column form section with consistent header */
export function FormSection({ title, description, children, actions }: FormSectionProps) {
  return (
    <SectionCard>
      <SectionHeader title={title} description={description} actions={actions} />
      <div className="ds-form-grid mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </SectionCard>
  )
}

export { ErpFormShell as FormLayout, ErpFormShell, ErpDrawerFormShell } from '../../components/erp/ErpFormShell'
