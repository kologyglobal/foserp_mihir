/**
 * Resolve Item Master default bin for transaction lines that have a bin field.
 * Prefers bin id match; falls back to code snapshot when bins are not yet loaded.
 * Always normalizes so select option `value` can match an id once bins are available.
 */
export function resolveItemDefaultBin(
  item: {
    defaultBinId?: string | null
    defaultBinCode?: string | null
  } | null | undefined,
  bins: Array<{ id: string; code: string }> = [],
): { binId: string | null; binCode: string } {
  if (!item) return { binId: null, binCode: '' }

  const rawId = typeof item.defaultBinId === 'string' ? item.defaultBinId.trim() : ''
  const rawCode = typeof item.defaultBinCode === 'string' ? item.defaultBinCode.trim() : ''

  if (rawId) {
    const hit = bins.find((b) => b.id === rawId)
    if (hit) return { binId: hit.id, binCode: hit.code }
    // Some payloads accidentally put the code in defaultBinId
    const asCode = bins.find(
      (b) => b.code.localeCompare(rawId, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (asCode) return { binId: asCode.id, binCode: asCode.code }
    return { binId: rawId, binCode: rawCode }
  }

  if (!rawCode) return { binId: null, binCode: '' }
  const byCode = bins.find(
    (b) => b.code.localeCompare(rawCode, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (byCode) return { binId: byCode.id, binCode: byCode.code }
  return { binId: null, binCode: rawCode }
}

/** Resolve binId/binCode pair against a bins catalog (for hydration + PR line codes). */
export function resolveBinSelection(
  binId: string | null | undefined,
  binCode: string | null | undefined,
  bins: Array<{ id: string; code: string }> = [],
): { binId: string | null; binCode: string } {
  const id = typeof binId === 'string' ? binId.trim() : ''
  const code = typeof binCode === 'string' ? binCode.trim() : ''
  if (id) {
    const hit = bins.find((b) => b.id === id)
    if (hit) return { binId: hit.id, binCode: hit.code }
    const asCode = bins.find(
      (b) => b.code.localeCompare(id, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (asCode) return { binId: asCode.id, binCode: asCode.code }
    return { binId: id, binCode: code }
  }
  if (code) {
    const byCode = bins.find(
      (b) => b.code.localeCompare(code, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (byCode) return { binId: byCode.id, binCode: byCode.code }
    return { binId: null, binCode: code }
  }
  return { binId: null, binCode: '' }
}
