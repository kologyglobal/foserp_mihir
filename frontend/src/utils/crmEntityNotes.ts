import type { DemoEntityNote } from '../types/crmEntity'

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
