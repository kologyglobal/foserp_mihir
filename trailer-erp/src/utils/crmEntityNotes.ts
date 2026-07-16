import type { DemoEntityNote } from '../types/crmEntity'

export function demoNotesFromTexts(
  items: Array<{ label?: string; text?: string | null; authorName?: string; createdAt?: string }>,
): DemoEntityNote[] {
  return items
    .filter((item) => String(item.text ?? '').trim())
    .map((item) => ({
      label: item.label,
      content: String(item.text).trim(),
      authorName: item.authorName,
      createdAt: item.createdAt,
    }))
}
