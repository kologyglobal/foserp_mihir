/**
 * Practical RFC-lite email checks — aligned with frontend/src/utils/validation/email.ts.
 * Does not verify mailbox existence.
 */

import { z } from 'zod'

const LOCAL_PART_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
const DOMAIN_LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateEmail(
  value: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return options?.required ? 'Email is required' : null
  }

  if (/\s/.test(trimmed)) {
    return 'Email must not contain spaces'
  }

  const atParts = trimmed.split('@')
  if (atParts.length !== 2) {
    return 'Email must contain exactly one @'
  }

  const [local, domain] = atParts
  if (!local || !domain) {
    return 'Invalid email address'
  }

  if (!LOCAL_PART_RE.test(local)) {
    return 'Invalid email address'
  }

  if (!domain.includes('.')) {
    return 'Invalid email domain'
  }

  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => !label)) {
    return 'Invalid email domain'
  }

  for (const label of labels) {
    if (!DOMAIN_LABEL_RE.test(label)) {
      return 'Invalid email domain'
    }
  }

  const tld = labels[labels.length - 1]
  if (tld.length < 2 || !/^[A-Za-z]{2,}$/.test(tld)) {
    return 'Invalid email domain'
  }

  return null
}

/** Optional / empty-or-valid email string (trim applied by caller or schema). */
export const optionalEmailSchema = z
  .string()
  .trim()
  .max(255)
  .refine((v) => validateEmail(v) === null, {
    message: 'Invalid email address',
  })
