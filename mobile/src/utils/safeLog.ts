/**
 * Safe diagnostics logging — never log tokens, passwords, or Authorization headers.
 */
const SENSITIVE = /password|token|authorization|refresh|secret|cookie/i

export function safeLog(scope: string, message: string, meta?: Record<string, unknown>): void {
  if (!__DEV__) return
  if (meta) {
    const scrubbed: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(meta)) {
      scrubbed[k] = SENSITIVE.test(k) ? '[redacted]' : v
    }
    console.log(`[${scope}] ${message}`, scrubbed)
    return
  }
  console.log(`[${scope}] ${message}`)
}
