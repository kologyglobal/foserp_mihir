import { normalizeEmail } from './validation/email'

export type ComposeMailOptions = {
  subject?: string
  body?: string
}

/** Gmail web compose URL with To / Subject / Body prefilled. */
export function buildGmailComposeUrl(
  to: string,
  options?: ComposeMailOptions,
): string | null {
  const addr = normalizeEmail(to)
  if (!addr || /\s/.test(addr) || !addr.includes('@')) return null

  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: addr,
  })
  if (options?.subject?.trim()) params.set('su', options.subject.trim())
  if (options?.body?.trim()) params.set('body', options.body.trim())
  return `https://mail.google.com/mail/?${params.toString()}`
}

/**
 * Open Gmail compose (To prefilled) in a new tab — keeps the ERP page open.
 * Does not use `mailto:` (often shows a blank page when no desktop mail app is set).
 */
export function openMailto(to: string, options?: ComposeMailOptions): void {
  const href = buildGmailComposeUrl(to, options)
  if (!href) return
  window.open(href, '_blank', 'noopener,noreferrer')
}

/** Dial via `tel:` without replacing the current SPA document. */
export function openTel(phone: string): void {
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return
  const href = `tel:${digits}`
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
