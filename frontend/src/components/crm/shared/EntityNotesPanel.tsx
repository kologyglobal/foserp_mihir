import { useState } from 'react'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { useEntityNotes } from '../../../hooks/useEntityNotes'
import { canCrmPermission } from '../../../utils/permissions/crm'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../../types/crmEntity'
import { crmNoteTypeLabel } from '../../../types/crmNote'
import { EntityNoteEditor } from './EntityNoteEditor'
import { ErpButton } from '../../erp/ErpButton'
import { formatDateTime } from '../../../utils/dates/format'
import { systemConfirm } from '../../../utils/systemConfirm'
import type { CreateEntityNoteInput } from '../../../services/api/crmApi'

interface EntityNotesPanelProps {
  entityType: CrmEntityTypeApi
  entityId: string
  title?: string
  className?: string
  /** Demo-mode notes preserved from legacy entity fields. */
  demoNotes?: DemoEntityNote[]
  /** Show legacy/demo notes even when API mode is active (no backend entity). */
  demoOnly?: boolean
  /** Prefill stage on new notes (additive; does not mutate prior stage notes). */
  defaultStageCode?: string | null
  stageOptions?: Array<{ code: string; label: string }>
}

function noteMetaParts(note: {
  authorName?: string
  createdAt?: string
  updatedAt?: string
  stageCode?: string | null
  noteType?: string | null
  label?: string
}) {
  const parts: string[] = []
  if (note.label) parts.push(note.label)
  const typeLabel = crmNoteTypeLabel(note.noteType)
  if (typeLabel) parts.push(typeLabel)
  if (note.stageCode) parts.push(`Stage: ${note.stageCode}`)
  parts.push(note.authorName || 'User')
  if (note.createdAt) parts.push(formatDateTime(note.createdAt))
  if (note.updatedAt && note.createdAt && note.updatedAt !== note.createdAt) parts.push('(edited)')
  return parts.join(' · ')
}

function DemoNotesList({ notes }: { notes: DemoEntityNote[] }) {
  if (notes.length === 0) {
    return <p className="text-[13px] text-erp-muted">No notes yet.</p>
  }
  return (
    <ul className="ent-360-notes space-y-3">
      {notes.map((note, index) => (
        <li key={`${note.label ?? 'note'}-${index}`} className="ent-360-notes__item">
          <p className="ent-360-notes__meta">{noteMetaParts(note)}</p>
          <p className="ent-360-notes__body whitespace-pre-wrap">{note.content}</p>
        </li>
      ))}
    </ul>
  )
}

export function EntityNotesPanel({
  entityType,
  entityId,
  title = 'Notes',
  className,
  demoNotes = [],
  demoOnly = false,
  defaultStageCode = null,
  stageOptions,
}: EntityNotesPanelProps) {
  const { notes, loading, error, pending, createNote, updateNote, deleteNote, isApiBacked } = useEntityNotes(
    entityType,
    entityId,
  )
  const [editingId, setEditingId] = useState<string | null>(null)

  const canCreate = canCrmPermission('crm.note.create')
  const canUpdate = canCrmPermission('crm.note.update')
  const canDelete = canCrmPermission('crm.note.delete')

  if (!isApiBacked || demoOnly) {
    return (
      <section className={className} aria-label={title}>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-erp-muted" />
          <h3 className="text-[14px] font-semibold text-erp-text">{title}</h3>
        </div>
        <DemoNotesList notes={demoNotes} />
      </section>
    )
  }

  return (
    <section className={className} aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-erp-muted" />
        <h3 className="text-[14px] font-semibold text-erp-text">{title}</h3>
      </div>

      {canCreate ? (
        <div className="mb-4">
          <EntityNoteEditor
            pending={pending}
            defaultStageCode={defaultStageCode}
            stageOptions={stageOptions}
            submitLabel="Add note"
            onSubmit={(input: CreateEntityNoteInput) => createNote(input)}
          />
        </div>
      ) : null}

      {loading ? <p className="text-[13px] text-erp-muted">Loading notes…</p> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      {!loading && notes.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No notes yet.</p>
      ) : (
        <ul className="ent-360-notes space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="ent-360-notes__item">
              {editingId === note.id ? (
                <EntityNoteEditor
                  editMode
                  initialContent={note.content}
                  pending={pending}
                  submitLabel="Update note"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (input) => {
                    const r = await updateNote(note.id, input.content)
                    if (r.ok) setEditingId(null)
                    return r
                  }}
                />
              ) : (
                <>
                  <p className="ent-360-notes__meta">{noteMetaParts(note)}</p>
                  <p className="ent-360-notes__body whitespace-pre-wrap">{note.content}</p>
                  {canUpdate || canDelete ? (
                    <div className="mt-2 flex gap-2">
                      {canUpdate ? (
                        <ErpButton type="button" size="sm" variant="secondary" icon={Pencil} onClick={() => setEditingId(note.id)}>
                          Edit
                        </ErpButton>
                      ) : null}
                      {canDelete ? (
                        <ErpButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={Trash2}
                          disabled={pending}
                          onClick={() => {
                            void systemConfirm({
                              title: 'Delete this note?',
                              description: 'The note will be removed from this record.',
                              confirmLabel: 'Delete',
                              cancelLabel: 'Cancel',
                              variant: 'danger',
                            }).then((ok) => {
                              if (ok) void deleteNote(note.id)
                            })
                          }}
                        >
                          Delete
                        </ErpButton>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
