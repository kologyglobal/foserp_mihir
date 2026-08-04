/** Parse free-text decimal entry; empty / partial input maps to 0. */
export function parseDecimalInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '.' || trimmed === '-' || trimmed === '-.') return 0
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : 0
}

export function isPartialDecimalText(raw: string): boolean {
  return raw === '' || /^-?\d*\.?\d*$/.test(raw)
}
