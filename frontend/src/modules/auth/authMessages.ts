/**
 * Map backend / network auth errors to business-friendly login copy.
 * Prefer known phrases; never invent email-existence hints.
 */
export function mapLoginErrorMessage(raw: string, status?: number): string {
  const message = (raw ?? '').trim()
  const lower = message.toLowerCase()

  if (status === 429 || /too many/.test(lower) || /rate.?limit/.test(lower)) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.'
  }
  if (/temporarily locked|account.*locked|lockedUntil/i.test(message) || /auth_account_locked/i.test(lower)) {
    return 'Account temporarily locked. Try again later or contact admin.'
  }
  if (/organization access is suspended|tenant.*(suspended|inactive)/i.test(message)) {
    return 'Organization access is suspended. Contact your administrator.'
  }
  if (/account is not active|account is inactive|your account is inactive/i.test(message)) {
    return 'Your account is inactive. Contact your administrator.'
  }
  if (/invalid (organization|tenant|email|password)|invalid credentials/i.test(message)) {
    return 'Invalid organization, email, or password'
  }
  if (/cannot reach the api|failed to fetch|networkerror/i.test(lower)) {
    return message || 'Cannot reach the API server. Ensure the backend is running.'
  }
  if (!message) {
    return 'Sign-in failed. Please try again.'
  }
  return message
}

export function mapForgotResetErrorMessage(raw: string, status?: number): string {
  const message = (raw ?? '').trim()
  const lower = message.toLowerCase()
  if (status === 429 || /too many/.test(lower)) {
    return 'Too many reset attempts. Please wait a few minutes and try again.'
  }
  if (/invalid or expired reset token/i.test(message)) {
    return 'That reset link or token is invalid or has expired. Request a new one.'
  }
  return message || 'Could not process password reset'
}
