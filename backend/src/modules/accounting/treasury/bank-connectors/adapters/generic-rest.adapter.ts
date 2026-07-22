/**
 * Phase 5D2 — Generic REST bank statement pull (allow-listed hosts only).
 * Credentials via credentialEnvKey → process.env (never stored in DB).
 */
import {
  getAllowedRestHosts,
  readCredentialFromEnv,
} from '../bank-connector.secrets.js'
import type {
  BankConnectorAdapter,
  BankConnectorAdapterContext,
  BankConnectorFetchedFile,
  BankConnectorRemoteFile,
  BankConnectorStatementFormatHint,
} from '../bank-connector.interface.js'

const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 5 * 1024 * 1024

function assertAllowedHost(baseUrl: string | null): URL {
  if (!baseUrl?.trim()) {
    throw Object.assign(new Error('baseUrl is required for GENERIC_REST live mode'), {
      code: 'NOT_CONFIGURED',
    })
  }
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw Object.assign(new Error('baseUrl is not a valid URL'), { code: 'NOT_CONFIGURED' })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('baseUrl must be http or https'), { code: 'NOT_CONFIGURED' })
  }
  const allowed = getAllowedRestHosts()
  if (allowed.length === 0) {
    throw Object.assign(
      new Error('BANK_CONNECTOR_ALLOWED_HOSTS is empty — refuse outbound REST calls'),
      { code: 'NOT_CONFIGURED' },
    )
  }
  if (!allowed.includes(url.hostname.toLowerCase())) {
    throw Object.assign(
      new Error(`Host ${url.hostname} is not in BANK_CONNECTOR_ALLOWED_HOSTS`),
      { code: 'NOT_CONFIGURED' },
    )
  }
  return url
}

function authHeaders(ctx: BankConnectorAdapterContext): Record<string, string> {
  const key =
    typeof ctx.configJson?.credentialEnvKey === 'string' ? ctx.configJson.credentialEnvKey : null
  const secret = readCredentialFromEnv(key)
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

function formatHint(ctx: BankConnectorAdapterContext): BankConnectorStatementFormatHint {
  const expected =
    typeof ctx.configJson?.expectedFormat === 'string' ? ctx.configJson.expectedFormat : undefined
  if (expected === 'MT940' || expected === 'CAMT053' || expected === 'CSV' || expected === 'OTHER') {
    return expected
  }
  return 'UNKNOWN'
}

async function fetchBuffer(url: string, headers: Record<string, string>): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from bank connector URL`)
    }
    const ab = await res.arrayBuffer()
    if (ab.byteLength > MAX_BYTES) {
      throw new Error(`Response exceeds ${MAX_BYTES} bytes`)
    }
    return Buffer.from(ab)
  } finally {
    clearTimeout(timer)
  }
}

export const genericRestLiveAdapter: BankConnectorAdapter = {
  providerCode: 'GENERIC_REST',

  async testConnection(ctx) {
    try {
      const base = assertAllowedHost(ctx.baseUrl)
      const headers = authHeaders(ctx)
      // Prefer HEAD; fall back to GET with range-less small probe via list path.
      const probeUrl = base.toString()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(probeUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
        if (!res.ok) {
          return {
            ok: false as const,
            code: 'ERROR' as const,
            message: `Probe returned HTTP ${res.status}`,
          }
        }
        // Drain body to free the socket; do not retain.
        await res.arrayBuffer().catch(() => undefined)
        return {
          ok: true as const,
          code: 'OK' as const,
          message: `REST endpoint reachable (${base.hostname})`,
        }
      } finally {
        clearTimeout(timer)
      }
    } catch (e) {
      const code = (e as { code?: string }).code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'ERROR'
      return {
        ok: false as const,
        code: code as 'NOT_CONFIGURED' | 'ERROR',
        message: e instanceof Error ? e.message : 'REST probe failed',
      }
    }
  },

  async listRemoteFiles(ctx): Promise<BankConnectorRemoteFile[]> {
    const base = assertAllowedHost(ctx.baseUrl)
    const remotePath =
      typeof ctx.configJson?.remotePath === 'string' ? ctx.configJson.remotePath.trim() : ''
    if (!remotePath) {
      // Treat baseUrl itself as the single statement file resource.
      return [{ name: 'statement', path: '', sizeBytes: undefined }]
    }
    const listUrl =
      typeof ctx.configJson?.listUrl === 'string' ? ctx.configJson.listUrl.trim() : ''
    if (listUrl) {
      const listParsed = new URL(listUrl, base)
      assertAllowedHost(listParsed.origin)
      const buffer = await fetchBuffer(listParsed.toString(), authHeaders(ctx))
      const json = JSON.parse(buffer.toString('utf8')) as { files?: BankConnectorRemoteFile[] }
      return Array.isArray(json.files) ? json.files : []
    }
    return [{ name: remotePath.split('/').pop() ?? 'statement', path: remotePath }]
  },

  async fetchStatementFile(ctx, remotePath: string): Promise<BankConnectorFetchedFile> {
    const base = assertAllowedHost(ctx.baseUrl)
    const target = remotePath
      ? new URL(remotePath.replace(/^\//, ''), base.toString().endsWith('/') ? base : `${base}/`)
      : base
    assertAllowedHost(target.origin)
    const buffer = await fetchBuffer(target.toString(), authHeaders(ctx))
    return {
      buffer,
      fileName: remotePath.split('/').pop() || 'statement.dat',
      formatHint: formatHint(ctx),
    }
  },
}
