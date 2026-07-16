/** Shallow compare two values — primitives by Object.is, arrays by reference + length + items. */
export function isSameValue<T>(current: T, next: T): boolean {
  if (Object.is(current, next)) return true
  if (Array.isArray(current) && Array.isArray(next)) {
    if (current.length !== next.length) return false
    return current.every((v, i) => Object.is(v, next[i]))
  }
  return false
}

/** Return next only when different — for use in Zustand set() callbacks. */
export function pickIfChanged<T>(current: T, next: T): T {
  return isSameValue(current, next) ? current : next
}

/** Guard navigation — skip when already on target path. */
export function shouldNavigate(currentPath: string, targetPath: string): boolean {
  return currentPath !== targetPath && targetPath.length > 0
}
