import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { EntityNoteEditor } from '@/components/crm/shared/EntityNoteEditor'
import { EntityNotesPanel } from '@/components/crm/shared/EntityNotesPanel'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import { canCrmPermission } from '@/utils/permissions/crm'
import { formatDateTime } from '@/utils/dates/format'
import type { DemoEntityNote } from '@/types/crmEntity'
import { cn } from '@/utils/cn'

export interface QuotationNotesCardProps {
  quotationId: string
  demoNotes?: DemoEntityNote[]
  editPath?: string
  className?: string
  composerOpen?: boolean
  onComposerOpenChange?: (open: boolean) => void
}

type UnifiedNote = {
  id: string
  content: string
  authorName: string
  createdAt: string
}

export function QuotationNotesCard({
  quotationId,
  demoNotes = [],
  editPath,
  className,
  composerOpen,
  onComposerOpenChange,
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

  function setAdding(open: boolean) {
    if (onComposerOpenChange) onComposerOpenChange(open)
    else setInternalAdding(open)
  }

  useEffect(() => {
    if (!composerOpen) return
    if (isApiBacked && canCreate) return
    onComposerOpenChange?.(false)
    if (editPath) navigate(editPath)
  }, [composerOpen, isApiBacked, canCreate, editPath, navigate, onComposerOpenChange])

  const latest = useMemo((): UnifiedNote | null => {
    if (isApiBacked && notes.length > 0) {
      const sorted = [...notes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      const n = sorted[0]!
      return {
        id: n.id,
        content: n.content,
        authorName: n.authorName || 'User',
        createdAt: n.createdAt,
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
              <span className="lead-notes-card__author">{latest.authorName}</span>
              {latest.createdAt ? (
                <span className="lead-notes-card__time">{formatDateTime(latest.createdAt)}</span>
              ) : null}
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
        />
      </CrmDrawerShell>
    </>
  )
}
