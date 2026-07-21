import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { EntityNoteEditor } from '@/components/crm/shared/EntityNoteEditor'
import { EntityNotesPanel } from '@/components/crm/shared/EntityNotesPanel'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import { canCrmPermission } from '@/utils/permissions/crm'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import type { DemoEntityNote } from '@/types/crmEntity'
import type { CrmEntityNoteDto } from '@/services/api/crmApi'
import { crmNoteTypeLabel } from '@/types/crmNote'
import type { QuotationDocumentStatus } from '@/types/crm'
import { cn } from '@/utils/cn'

/** Quotation notes are stage-stamped with the document workflow status. */
export const QUOTATION_NOTE_STAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'draft', label: 'Draft' },
  { code: 'pending_approval', label: 'Pending Internal Approval' },
  { code: 'approved', label: 'Approved' },
  { code: 'sent', label: 'Sent to Customer' },
  { code: 'rejected', label: 'Rejected' },
  { code: 'superseded', label: 'Superseded' },
  { code: 'converted', label: 'Converted to Sales Order' },
]

export function quotationNoteStageLabel(code: string): string {
  return QUOTATION_NOTE_STAGE_OPTIONS.find((s) => s.code === code)?.label ?? code.replace(/_/g, ' ')
}

export interface QuotationNotesCardProps {
  quotationId: string
  /** Current document status — stamped on new notes only (additive history). */
  currentStage?: QuotationDocumentStatus | string | null
  demoNotes?: DemoEntityNote[]
  editPath?: string
  className?: string
  composerOpen?: boolean
  onComposerOpenChange?: (open: boolean) => void
  /** Reports API entity notes upward (e.g. to merge into the unified timeline). */
  onNotesChange?: (notes: CrmEntityNoteDto[]) => void
}

type UnifiedNote = {
  id: string
  content: string
  authorName: string
  createdAt: string
  stageCode?: string | null
  noteType?: string | null
}

export function QuotationNotesCard({
  quotationId,
  currentStage = null,
  demoNotes = [],
  editPath,
  className,
  composerOpen,
  onComposerOpenChange,
  onNotesChange,
}: QuotationNotesCardProps) {
  const navigate = useNavigate()
  const { notes, loading, pending, createNote, isApiBacked, refresh } = useEntityNotes(
    'QUOTATION',
    quotationId,
  )
  const [internalAdding, setInternalAdding] = useState(false)
  const [viewAllOpen, setViewAllOpen] = useState(false)
  const canCreate = canCrmPermission('crm.note.create')
  const adding = composerOpen ?? internalAdding

  useEffect(() => {
    if (isApiBacked) onNotesChange?.(notes)
  }, [isApiBacked, notes, onNotesChange])

  function setAdding(open: boolean) {
    if (onComposerOpenChange) onComposerOpenChange(open)
    else setInternalAdding(open)
  }

  useEffect(() => {
    if (!composerOpen) return
    if (isApiBacked && canCreate) return
    onComposerOpenChange?.(false)
    if (isApiBacked && !canCreate) {
      notify.error('You do not have permission to add notes (crm.note.create).')
      return
    }
    if (editPath) navigate(editPath)
  }, [composerOpen, isApiBacked, canCreate, editPath, navigate, onComposerOpenChange])

  const latest = useMemo((): UnifiedNote | null => {
    // API mode shows real entity notes only — document scalar fields are not notes.
    if (isApiBacked) {
      if (notes.length === 0) return null
      const sorted = [...notes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      const n = sorted[0]!
      return {
        id: n.id,
        content: n.content,
        authorName: n.authorName || 'User',
        createdAt: n.createdAt,
        stageCode: n.stageCode,
        noteType: n.noteType,
      }
    }
    if (demoNotes.length > 0) {
      const sorted = [...demoNotes].sort((a, b) =>
        String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
      )
      const n = sorted[0]!
      return {
        id: `demo-0`,
        content: n.content,
        authorName: n.authorName || 'User',
        createdAt: n.createdAt ?? '',
        stageCode: n.stageCode,
        noteType: n.noteType,
      }
    }
    return null
  }, [isApiBacked, notes, demoNotes])

  const noteCount = isApiBacked ? notes.length : demoNotes.length

  function handleAddNote() {
    if (isApiBacked && canCreate) {
      setAdding(true)
      return
    }
    if (isApiBacked && !canCreate) {
      notify.error('You do not have permission to add notes (crm.note.create).')
      return
    }
    if (editPath) {
      navigate(editPath)
      return
    }
    setViewAllOpen(true)
  }

  return (
    <>
      <section className={cn('lead-notes-card', className)} id="quo-section-notes" aria-label="Notes">
        <header className="lead-notes-card__head">
          <div className="lead-notes-card__head-main">
            <MessageSquare className="lead-notes-card__icon" aria-hidden />
            <div>
              <h2 className="lead-notes-card__title">Notes</h2>
              <p className="lead-notes-card__subtitle">
                {noteCount > 0 ? `${noteCount} note${noteCount === 1 ? '' : 's'}` : 'No notes yet'}
              </p>
            </div>
          </div>
          <div className="lead-notes-card__actions">
            <ErpButton type="button" size="sm" variant="secondary" icon={Plus} onClick={handleAddNote}>
              Add Note
            </ErpButton>
            {noteCount > 0 ? (
              <button type="button" className="lead-notes-card__link" onClick={() => setViewAllOpen(true)}>
                View all notes
              </button>
            ) : null}
          </div>
        </header>

        {adding && isApiBacked ? (
          <div className="lead-notes-card__composer">
            <EntityNoteEditor
              pending={pending}
              submitLabel="Save note"
              defaultStageCode={currentStage ?? null}
              stageOptions={QUOTATION_NOTE_STAGE_OPTIONS}
              onCancel={() => setAdding(false)}
              onSubmit={async (input) => {
                const r = await createNote(input)
                if (r.ok) {
                  setAdding(false)
                  void refresh()
                }
                return r
              }}
            />
          </div>
        ) : null}

        {loading ? (
          <p className="lead-notes-card__empty">Loading notes…</p>
        ) : latest ? (
          <article className="lead-notes-card__latest">
            <p className="lead-notes-card__meta">
              {[
                crmNoteTypeLabel(latest.noteType),
                latest.stageCode ? `Stage: ${quotationNoteStageLabel(latest.stageCode)}` : '',
                latest.authorName,
                latest.createdAt ? formatDateTime(latest.createdAt) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="lead-notes-card__body">{latest.content}</p>
          </article>
        ) : !adding ? (
          <p className="lead-notes-card__empty">No notes yet. Add the first note to capture context.</p>
        ) : null}
      </section>

      <CrmDrawerShell
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        title="All notes"
        subtitle="Quotation notes history"
        width="md"
      >
        <EntityNotesPanel
          entityType="QUOTATION"
          entityId={quotationId}
          demoNotes={demoNotes}
          title="Notes"
          defaultStageCode={currentStage ?? null}
          stageOptions={QUOTATION_NOTE_STAGE_OPTIONS}
        />
      </CrmDrawerShell>
    </>
  )
}
