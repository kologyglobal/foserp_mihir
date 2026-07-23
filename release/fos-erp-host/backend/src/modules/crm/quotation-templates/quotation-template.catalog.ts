import { env } from '../../../config/env.js'

/** Only these catalog codes stay active — must match prisma/quotationTemplateSeedData.ts */
export const QUOTATION_TEMPLATE_KEEP_CODES = ['ISO-TANK-26KL', 'ISO-DRY-BULK-25CBM'] as const

/**
 * Live catalog lock: only the two VF ISO Word templates are visible / creatable.
 * - production → locked by default
 * - CRM_LOCK_QUOTATION_TEMPLATE_CATALOG=true|false overrides
 * - test → unlocked so e2e can create temporary templates
 */
export function isQuotationTemplateCatalogLocked(): boolean {
  const flag = process.env.CRM_LOCK_QUOTATION_TEMPLATE_CATALOG
  if (flag === 'false') return false
  if (flag === 'true') return true
  if (env.isTest) return false
  return env.isProd
}

export function quotationTemplateKeepCodes(): string[] {
  return [...QUOTATION_TEMPLATE_KEEP_CODES]
}

export function isAllowedQuotationTemplateCode(code: string | null | undefined): boolean {
  if (!code) return false
  return (QUOTATION_TEMPLATE_KEEP_CODES as readonly string[]).includes(code)
}
