import { useState } from 'react'
import { ErpButton } from '../../erp/ErpButton'
import { Textarea } from '../../forms/Inputs'

interface EntityNoteEditorProps {
  initialContent?: string
  submitLabel?: string
  pending?: boolean
  onSubmit: (content: string) => Promise<{ ok: boolean; error?: string }>
  onCancel?: () => void
}

export function EntityNoteEditor({
  initialContent = '',
  submitLabel = 'Save note',
  pending = false,
  onSubmit,
  onCancel,
}: EntityNoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Note content is required.')
      return
    }
    setError(null)
    const result = await onSubmit(trimmed)
    if (!result.ok) {
      setError(result.error ?? 'Save failed')
      return
    }
    if (!initialContent) setContent('')
  }

  return (
    <form className="ent-360-notes-editor space-y-2" onSubmit={(e) => void handleSubmit(e)}>
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
