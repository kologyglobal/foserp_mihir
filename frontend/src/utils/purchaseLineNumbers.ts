/** Stable purchase document line numbers — gaps preserved when deleting from the middle. */

export function maxPurchaseLineNo(lines: Array<{ lineNo?: number | null }>): number {
  return lines.reduce((max, line) => Math.max(max, Number(line.lineNo) || 0), 0)
}

/** Next line number = max existing + 1 (never reuses a gap from a middle delete). */
export function nextPurchaseLineNo(lines: Array<{ lineNo?: number | null }>): number {
  return maxPurchaseLineNo(lines) + 1
}
