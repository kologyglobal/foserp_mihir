import type { DemoEntityNote } from '../types/crmEntity'
import { crmNoteTypeLabel } from '../types/crmNote'

export function demoNotesFromTexts(
  items: Array<{
    label?: string
    text?: string | null
    authorName?: string
    createdAt?: string
    stageCode?: string | null
    noteType?: string | null
  }>,
): DemoEntityNote[] {
  return items
    .filter((item) => String(item.text ?? '').trim())
    .map((item) => ({
      label: item.label,
      content: String(item.text).trim(),
      authorName: item.authorName,
      createdAt: item.createdAt,
      stageCode: item.stageCode ?? null,
      noteType: item.noteType ?? null,
    }))
}

/** Map API entity notes (crm_notes rows) into unified-feed note items with readable labels. */
export function entityNotesToFeedNotes(
  notes: Array<{
    content: string
    authorName?: string
    createdAt?: string
    stageCode?: string | null
    noteType?: string | null
  }>,
  stageLabelFor?: (code: string) => string,
): DemoEntityNote[] {
  return notes.map((n) => {
    const typeLabel = crmNoteTypeLabel(n.noteType) || 'Note'
    const stageLabel = n.stageCode ? (stageLabelFor?.(n.stageCode) ?? n.stageCode) : ''
    return {
      label: stageLabel ? `${typeLabel} · ${stageLabel}` : typeLabel,
      content: n.content,
      authorName: n.authorName,
      createdAt: n.createdAt,
      stageCode: n.stageCode ?? null,
      noteType: n.noteType ?? null,
    }
  })
}
