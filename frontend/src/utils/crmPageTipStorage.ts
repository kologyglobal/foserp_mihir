const STORAGE_KEY = 'crmPageTipDismissed'
const STORAGE_KEY_LEGACY = 'crmPageTipDismissed'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NUMERIC_ID_RE = /^\d+$/

/** Auth / public routes — no page tip. */
const TIP_EXCLUDED_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/auth']

/** Stable page id for tip dismiss state (strips record ids). */
export function getCrmPageTipId(pathname: string): string {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  const normalized = parts.map((part) => {
    if (UUID_RE.test(part) || NUMERIC_ID_RE.test(part)) return ':id'
    if (part === 'new' || part === 'edit') return part
    return part
  })
  return `/${normalized.join('/')}`
}

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore quota / private mode */
  }
}

export function isCrmPageTipDismissed(pageId: string): boolean {
  return readDismissed().has(pageId)
}

export function dismissCrmPageTip(pageId: string): void {
  const next = readDismissed()
  next.add(pageId)
  writeDismissed(next)
}

/** @deprecated Prefer shouldShowPageTip — tip is system-wide. */
export function isCrmPath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  return path === '/crm' || path.startsWith('/crm/')
}

/** Whether the compact Page tip control should render for this route. */
export function shouldShowPageTip(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  if (path === '/') return true
  return !TIP_EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
