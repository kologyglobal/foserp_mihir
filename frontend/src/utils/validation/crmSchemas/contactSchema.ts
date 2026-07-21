import { z } from 'zod'
import { optionalEmailField } from '../emailZod'
import { mobileDigitsOnly, validateMobileForCountry } from '../mobilePhone'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { requiredText } from '../crmFields'

/**
 * Contact form schema. Pass a country getter so mobile validation stays in sync
 * with the linked company country (same behavior as CrmContactFormPage).
 */
export function buildContactSchema(getCountry: () => string | null | undefined) {
  return z.object({
    contactCode: requiredText('Contact code is required'),
    customerId: requiredText('Company is required'),
    name: requiredText('Contact name is required'),
    designation: z.string().optional(),
    department: z.string().optional(),
    email: optionalEmailField,
    phone: z
      .string()
      .trim()
      .transform((s) => mobileDigitsOnly(s))
      .superRefine((digits, ctx) => {
        if (!digits) return
        const message = validateMobileForCountry(digits, getCountry() ?? DEFAULT_CUSTOMER_COUNTRY)
        if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message })
      })
      .optional(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
}

export type ContactFormData = z.infer<ReturnType<typeof buildContactSchema>>

export const CONTACT_FIELD_ORDER = [
  'contactCode',
  'name',
  'customerId',
  'phone',
  'email',
  'designation',
  'department',
] as const

export const CONTACT_SECTION_BY_FIELD: Record<string, string> = {
  contactCode: 'contact-section-quick',
  name: 'contact-section-quick',
  customerId: 'contact-section-quick',
  phone: 'contact-section-quick',
  email: 'contact-section-quick',
  designation: 'contact-section-quick',
  department: 'contact-section-details',
}
