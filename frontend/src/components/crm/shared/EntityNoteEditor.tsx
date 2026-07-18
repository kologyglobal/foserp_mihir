import { useState } from 'react'
import { ErpButton } from '../../erp/ErpButton'
import { Textarea } from '../../forms/Inputs'
import type { CreateEntityNoteInput } from '../../../services/api/crmApi'
import { CRM_NOTE_TYPES, CRM_NOTE_TYPE_LABELS, type CrmNoteType } from '../../../types/crmNote'

interface EntityNoteEditorProps {
  initialContent?: string
  /** When editing, hide note-type/stage fields (immutable after create). */
  editMode?: boolean
  defaultNoteType?: CrmNoteType | null
  defaultStageCode?: string | null
  /** Optional stage picker codes (e.g. current lead/opp stage). */
  stageOptions?: Array<{ code: string; label: string }>
  submitLabel?: string
  pending?: boolean
  onSubmit: (input: CreateEntityNoteInput) => Promise<{ ok: boolean; error?: string }>
  onCancel?: () => void
}

export function EntityNoteEditor({
  initialContent = '',
  editMode = false,
  defaultNoteType = 'general',
  defaultStageCode = null,
  stageOptions,
  submitLabel = 'Save note',
  pending = false,
  onSubmit,
  onCancel,
}: EntityNoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [noteType, setNoteType] = useState<CrmNoteType | ''>(defaultNoteType ?? 'general')
  const [stageCode, setStageCode] = useState(defaultStageCode ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Note content is required.')
      return
    }
    setError(null)
    const result = await onSubmit(
      editMode
        ? { content: trimmed }
        : {
            content: trimmed,
            noteType: noteType || null,
            stageCode: stageCode.trim() || null,
          },
    )
    if (!result.ok) {
      setError(result.error ?? 'Save failed')
      return
    }
    if (!initialContent) {
      setContent('')
      setNoteType(defaultNoteType ?? 'general')
      setStageCode(defaultStageCode ?? '')
    }
  }

  return (
    <form className="ent-360-notes-editor space-y-2" onSubmit={(e) => void handleSubmit(e)}>
      {!editMode ? (
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[12px] text-erp-muted">
            Note type
            <select
              className="erp-input w-full text-[13px]"
              value={noteType}
              disabled={pending}
              onChange={(e) => setNoteType(e.target.value as CrmNoteType)}
            >
              {CRM_NOTE_TYPES.map((code) => (
                <option key={code} value={code}>
                  {CRM_NOTE_TYPE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          {stageOptions && stageOptions.length > 0 ? (
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[12px] text-erp-muted">
              Stage
              <select
                className="erp-input w-full text-[13px]"
                value={stageCode}
                disabled={pending}
                onChange={(e) => setStageCode(e.target.value)}
              >
                <option value="">— None —</option>
                {stageOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <Textarea
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a note…"
        disabled={pending}
        className="erp-input w-full"
      />
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <div className="flex items-center gap-2">
        <ErpButton type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </ErpButton>
        {onCancel ? (
          <ErpButton type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </ErpButton>
        ) : null}
      </div>
    </form>
  )
}
