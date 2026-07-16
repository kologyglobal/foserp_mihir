import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Circle } from 'lucide-react'
import {
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
  type EnterpriseFormMetric,
} from '../../design-system/workspace'
import type { EnterpriseDocumentStripField } from '../../design-system/workspace/types'

export const PURCHASE_SECTION_ID_PREFIX = 'purchase-section'

export function purchaseSectionId(section: string): string {
  return `${PURCHASE_SECTION_ID_PREFIX}-${section}`
}

export function scrollToPurchaseSection(sectionId: string, onActive?: (id: string) => void) {
  onActive?.(sectionId)
  document.getElementById(purchaseSectionId(sectionId))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Scroll to a field (preferred) or FastTab section after validation expands it. */
export function scrollToPurchaseValidationTarget(options: {
  fieldId?: string | null
  sectionId?: string | null
  onActive?: (id: string) => void
}) {
  const { fieldId, sectionId, onActive } = options
  if (sectionId) onActive?.(sectionId)
  const run = () => {
    const field = fieldId ? document.getElementById(fieldId) : null
    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (sectionId) {
      document
        .getElementById(purchaseSectionId(sectionId))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  // Wait a frame so forceOpenKey can expand the FastTab before scrolling.
  requestAnimationFrame(() => requestAnimationFrame(run))
}

export type PurchaseSectionNavItem = {
  id: string
  label: string
  icon: LucideIcon
  done?: boolean
}

export function PurchaseFormSectionNav({
  sections,
  activeId,
  onSelect,
  trailing,
}: {
  sections: PurchaseSectionNavItem[]
  activeId: string
  onSelect: (id: string) => void
  /** Optional; reopen FactBox lives on `PurchaseCardFormShell` toolbar (CRM Lead360 pattern). */
  trailing?: ReactNode
}) {
  return (
    <EnterpriseFormSectionNav
      sections={sections}
      activeId={activeId}
      onSelect={(id) => scrollToPurchaseSection(id, onSelect)}
      trailing={trailing}
    />
  )
}

export type PurchaseFactBoxAction = {
  id: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}

export function PurchaseEnterpriseFactBox({
  metrics,
  summary,
  actions,
  title = 'Purchase insight',
  children,
}: {
  metrics?: EnterpriseFormMetric[]
  summary: { label: string; value: ReactNode; highlight?: boolean }[]
  actions?: PurchaseFactBoxAction[]
  title?: string
  children?: ReactNode
}) {
  return (
    <>
      {metrics?.length ? <EnterpriseFormMetrics metrics={metrics} className="dyn-form-metrics--factbox" /> : null}
      <EnterpriseBusinessFactBox title={title}>
        <EnterpriseFormContextPanel
          summaryTitle="Summary"
          actionsTitle="Quick Actions"
          summary={summary}
          actions={actions?.map((action) => ({
            ...action,
            icon: action.icon ?? Circle,
          }))}
        />
        {children}
      </EnterpriseBusinessFactBox>
    </>
  )
}

/** Map legacy status strip chips to CRM-style document strip fields. */
export function purchaseStatusStripToDocumentStrip(
  items: { label: string; value: string; tone?: string; highlight?: boolean }[],
): EnterpriseDocumentStripField[] {
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    highlight: item.highlight ?? (item.tone === 'success' || item.tone === 'info'),
  }))
}
