/** Business-friendly auth messages shared by service + tests. */

export const AUTH_MSG = {
  INVALID_CREDENTIALS: 'Invalid organization, email, or password',
  ACCOUNT_INACTIVE: 'Your account is inactive. Contact your administrator.',
  TENANT_SUSPENDED: 'Organization access is suspended. Contact your administrator.',
  ACCOUNT_LOCKED: 'Account temporarily locked. Try again later or contact admin.',
  RATE_LIMITED: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  RESET_GENERIC: 'If the account exists, a password reset link has been sent',
  RESET_TOKEN_INVALID: 'Invalid or expired reset token',
} as const

export const AUTH_CODE = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
  TENANT_SUSPENDED: 'AUTH_TENANT_SUSPENDED',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  CURRENT_PASSWORD_INCORRECT: 'AUTH_CURRENT_PASSWORD_INCORRECT',
} as const

/** Failed password attempts before temporary lock. */
export const LOGIN_LOCKOUT_THRESHOLD = 5
/** Lock duration after threshold failures. */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000
