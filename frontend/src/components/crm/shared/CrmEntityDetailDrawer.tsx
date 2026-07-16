import { EntityNotesPanel } from './EntityNotesPanel'
import { CrmDrawerShell } from '../CrmDrawerShell'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../../types/crmEntity'

interface CrmEntityDetailDrawerProps {
  open: boolean
  onClose: () => void
  entityType: CrmEntityTypeApi
  entityId: string | null
  title: string
  subtitle?: string
  demoNotes?: DemoEntityNote[]
}

/** Activity / follow-up detail drawer with entity-scoped notes. */
export function CrmEntityDetailDrawer({
  open,
  onClose,
  entityType,
  entityId,
  title,
  subtitle,
  demoNotes,
}: CrmEntityDetailDrawerProps) {
  return (
    <CrmDrawerShell open={open} onClose={onClose} title={title} subtitle={subtitle} width="md">
      {entityId ? (
        <EntityNotesPanel
          entityType={entityType}
          entityId={entityId}
          demoNotes={demoNotes}
          title="Notes"
        />
      ) : (
        <p className="text-[13px] text-erp-muted">Record not found.</p>
      )}
    </CrmDrawerShell>
  )
}
