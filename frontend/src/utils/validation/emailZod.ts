import { z } from 'zod'
import { validateEmail } from './email'

const EMAIL_MAX = 255

/** Optional email: empty allowed; otherwise practical RFC-lite structure. */
export const optionalEmailField = z
  .string()
  .max(EMAIL_MAX, 'Email is too long')
  .superRefine((val, ctx) => {
    const message = validateEmail(val)
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    }
  })

/** Required email with the same structure rules. */
export const requiredEmailField = z
  .string()
  .max(EMAIL_MAX, 'Email is too long')
  .superRefine((val, ctx) => {
    const message = validateEmail(val, { required: true })
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    }
  })
