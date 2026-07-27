/**
 * A1.3 — Token refresh single-flight + session-clear on failure.
 * Run: npx tsx --tsconfig tsconfig.app.json scripts/test-auth-refresh-singleflight.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const mem = new Map<string, string>()
const sessionMem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage; sessionStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(k: string) {
    return mem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    mem.set(k, v)
  },
  removeItem(k: string) {
    mem.delete(k)
  },
  key() {
    return null
  },
}
;(globalThis as typeof globalThis & { sessionStorage: Storage }).sessionStorage = {
  get length() {
    return sessionMem.size
  },
  clear() {
    sessionMem.clear()
  },
  getItem(k: string) {
    return sessionMem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    sessionMem.set(k, v)
  },
  removeItem(k: string) {
    sessionMem.delete(k)
  },
  key() {
    return null
  },
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    process.exitCode = 1
  } else {
    console.log(`  ✓ ${msg}`)
  }
}

console.log('\nA1.3 — Auth refresh single-flight\n')

const clientSrc = readFileSync(path.join(ROOT, 'src/services/api/client.ts'), 'utf8')
assert(clientSrc.includes('let refreshPromise'), 'client.ts declares single-flight refreshPromise')
assert(clientSrc.includes('ensureFreshAccessToken'), 'ensureFreshAccessToken exported')
assert(clientSrc.includes('refreshAfterUnauthorized'), '401 retry uses shared refresh helper')
assert(clientSrc.includes('clearSessionWithNotice'), 'failed refresh clears session with notice')
assert(clientSrc.includes('consumeAuthNotice') || clientSrc.includes('setAuthNotice'), 'auth notice helpers present')
assert(
  !clientSrc.includes('?? accessToken') || !/ensureFreshAccessToken\(\)\)\s*\?\?\s*accessToken/.test(clientSrc),
  'does not fall back to stale access token after failed refresh',
)

const {
  setStoredSession,
  getStoredSession,
  ensureFreshAccessToken,
  consumeAuthNotice,
  SESSION_EXPIRED_NOTICE,
} = await import('../src/services/api/client')

mem.clear()
sessionMem.clear()

setStoredSession({
  accessToken: 'access-old',
  refreshToken: 'refresh-shared',
  tenantId: 't1',
  tenantSlug: 'vasant-trailers',
  accessTokenExpiresAt: Date.now() - 1000,
  user: {
    id: 'u1',
    firstName: 'Test',
    lastName: 'User',
    email: 't@example.com',
    roles: [],
    permissions: [],
  },
})

let refreshCalls = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async (input) => {
  const url = String(input)
  if (url.includes('/auth/refresh-token')) {
    refreshCalls += 1
    await new Promise((r) => setTimeout(r, 40))
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token refreshed',
        data: {
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
          expiresIn: 900_000,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return originalFetch(input)
}

const [a, b, c] = await Promise.all([
  ensureFreshAccessToken(),
  ensureFreshAccessToken(),
  ensureFreshAccessToken(),
])

assert(refreshCalls === 1, `concurrent ensureFreshAccessToken issues one refresh (got ${refreshCalls})`)
assert(a === 'access-new' && b === 'access-new' && c === 'access-new', 'all callers receive the new access token')
assert(getStoredSession()?.refreshToken === 'refresh-new', 'stored session updated with rotated refresh token')

mem.clear()
sessionMem.clear()
refreshCalls = 0
setStoredSession({
  accessToken: 'access-old',
  refreshToken: 'refresh-bad',
  tenantId: 't1',
  tenantSlug: 'vasant-trailers',
  accessTokenExpiresAt: Date.now() - 1000,
  user: {
    id: 'u1',
    firstName: 'Test',
    lastName: 'User',
    email: 't@example.com',
    roles: [],
    permissions: [],
  },
})

globalThis.fetch = async (input) => {
  const url = String(input)
  if (url.includes('/auth/refresh-token')) {
    refreshCalls += 1
    return new Response(JSON.stringify({ success: false, message: 'Invalid or expired refresh token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return originalFetch(input)
}

const failed = await ensureFreshAccessToken()
assert(failed === null, 'failed refresh returns null')
assert(getStoredSession() === null, 'failed refresh clears stored session')
assert(consumeAuthNotice() === SESSION_EXPIRED_NOTICE, 'failed refresh sets login notice')

globalThis.fetch = originalFetch

const denied = readFileSync(path.join(ROOT, 'src/components/system/PermissionDeniedPage.tsx'), 'utf8')
const notFound = readFileSync(path.join(ROOT, 'src/components/system/PageNotFoundPage.tsx'), 'utf8')
const protectedRoute = readFileSync(path.join(ROOT, 'src/components/auth/ProtectedRoute.tsx'), 'utf8')
assert(denied.includes('Permission denied') && denied.includes('403'), 'Access Denied page is distinct (403)')
assert(notFound.includes('Page not found') && notFound.includes('404'), '404 page is distinct')
assert(
  /return <PermissionDeniedPage/.test(protectedRoute) && !/return <PageNotFoundPage/.test(protectedRoute),
  'ProtectedOutlet renders PermissionDeniedPage (not 404) on permission failure',
)

console.log(`\nA1.3 refresh/guards: ${process.exitCode ? 'FAIL' : 'PASS'}\n`)
process.exit(process.exitCode ?? 0)
