import { useState } from 'react'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { useEntityNotes } from '../../../hooks/useEntityNotes'
import { canCrmPermission } from '../../../utils/permissions/crm'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../../types/crmEntity'
import { EntityNoteEditor } from './EntityNoteEditor'
import { ErpButton } from '../../erp/ErpButton'
import { formatDateTime } from '../../../utils/dates/format'
interface EntityNotesPanelProps {
  entityType: CrmEntityTypeApi
  entityId: string
  title?: string
  className?: string
  /** Demo-mode notes preserved from legacy entity fields. */
  demoNotes?: DemoEntityNote[]
  /** Show legacy/demo notes even when API mode is active (no backend entity). */
  demoOnly?: boolean
}

function DemoNotesList({ notes }: { notes: DemoEntityNote[] }) {
  if (notes.length === 0) {
    return <p className="text-[13px] text-erp-muted">No notes yet.</p>
  }
  return (
    <ul className="ent-360-notes space-y-3">
      {notes.map((note, index) => (
        <li key={`${note.label ?? 'note'}-${index}`} className="ent-360-notes__item">
          <p className="ent-360-notes__meta">
            {note.label ? `${note.label} · ` : ''}
            {note.authorName || 'User'}
            {note.createdAt ? ` · ${formatDateTime(note.createdAt)}` : ''}
          </p>
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
          <EntityNoteEditor pending={pending} onSubmit={createNote} submitLabel="Add note" />
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
                  initialContent={note.content}
                  pending={pending}
                  submitLabel="Update note"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (content) => {
                    const r = await updateNote(note.id, content)
                    if (r.ok) setEditingId(null)
                    return r
                  }}
                />
              ) : (
                <>
                  <p className="ent-360-notes__meta">
                    {note.authorName || 'User'} · {formatDateTime(note.createdAt)}
                    {note.updatedAt !== note.createdAt ? ' (edited)' : ''}
                  </p>
                  <p className="ent-360-notes__body whitespace-pre-wrap">{note.content}</p>
                  {(canUpdate || canDelete) ? (
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
                            if (window.confirm('Delete this note?')) void deleteNote(note.id)
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
