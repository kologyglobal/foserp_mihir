/**
 * Phase 5D3 — live SFTP pull for MT940_SFTP / CAMT_SFTP.
 * Credentials via env key refs only. Host must be allow-listed.
 */
import { createHash } from 'node:crypto'
import { env } from '../../../../../config/env.js'
import {
  getAllowedSftpHosts,
  readCredentialFromEnv,
} from '../bank-connector.secrets.js'
import type {
  BankConnectorAdapter,
  BankConnectorAdapterContext,
  BankConnectorFetchedFile,
  BankConnectorRemoteFile,
  BankConnectorStatementFormatHint,
} from '../bank-connector.interface.js'
import type { BankConnectorProviderCode } from '../bank-connector.enums.js'
import { getSftpClientFactory, type SftpConnectOptions } from './sftp-client.js'

function matchPattern(fileName: string, pattern: string | undefined): boolean {
  if (!pattern || pattern === '*') return true
  if (pattern.startsWith('*.')) {
    return fileName.toLowerCase().endsWith(pattern.slice(1).toLowerCase())
  }
  if (pattern.endsWith('*')) {
    return fileName.toLowerCase().startsWith(pattern.slice(0, -1).toLowerCase())
  }
  return fileName === pattern
}

function formatHint(
  provider: string,
  expected?: string,
): BankConnectorStatementFormatHint {
  if (expected === 'MT940' || expected === 'CAMT053' || expected === 'CSV' || expected === 'OTHER') {
    return expected
  }
  if (provider === 'CAMT_SFTP') return 'CAMT053'
  return 'MT940'
}

function resolveHostPort(ctx: BankConnectorAdapterContext): { host: string; port: number } {
  const cfg = ctx.configJson ?? {}
  if (typeof cfg.host === 'string' && cfg.host.trim()) {
    const port = typeof cfg.port === 'number' ? cfg.port : Number(cfg.port ?? 22)
    return { host: cfg.host.trim().toLowerCase(), port: Number.isFinite(port) ? port : 22 }
  }
  if (ctx.baseUrl?.trim()) {
    try {
      const u = new URL(ctx.baseUrl.includes('://') ? ctx.baseUrl : `sftp://${ctx.baseUrl}`)
      return { host: u.hostname.toLowerCase(), port: u.port ? Number(u.port) : 22 }
    } catch {
      throw Object.assign(new Error('baseUrl / host is invalid for SFTP'), { code: 'NOT_CONFIGURED' })
    }
  }
  throw Object.assign(new Error('SFTP host is required (configJson.host or baseUrl)'), {
    code: 'NOT_CONFIGURED',
  })
}

function assertHostAllowed(host: string): void {
  const allowed = getAllowedSftpHosts()
  if (allowed.length === 0) {
    throw Object.assign(
      new Error('BANK_CONNECTOR_SFTP_ALLOWED_HOSTS is empty — refuse SFTP connections'),
      { code: 'NOT_CONFIGURED' },
    )
  }
  if (!allowed.includes(host.toLowerCase())) {
    throw Object.assign(new Error(`SFTP host ${host} is not in BANK_CONNECTOR_SFTP_ALLOWED_HOSTS`), {
      code: 'NOT_CONFIGURED',
    })
  }
}

function buildConnectOptions(ctx: BankConnectorAdapterContext): SftpConnectOptions {
  const { host, port } = resolveHostPort(ctx)
  assertHostAllowed(host)
  const cfg = ctx.configJson ?? {}
  const usernameEnv =
    typeof cfg.usernameEnvKey === 'string' ? cfg.usernameEnvKey : null
  const passwordEnv =
    typeof cfg.passwordEnvKey === 'string' ? cfg.passwordEnvKey : null
  const privateKeyEnv =
    typeof cfg.privateKeyEnvKey === 'string' ? cfg.privateKeyEnvKey : null
  const passphraseEnv =
    typeof cfg.passphraseEnvKey === 'string' ? cfg.passphraseEnvKey : null

  const username = readCredentialFromEnv(usernameEnv)
  if (!username) {
    throw Object.assign(new Error('usernameEnvKey is required and must resolve to a non-empty env value'), {
      code: 'NOT_CONFIGURED',
    })
  }

  const password = readCredentialFromEnv(passwordEnv)
  const privateKey = readCredentialFromEnv(privateKeyEnv)
  const passphrase = readCredentialFromEnv(passphraseEnv) ?? undefined
  if (!password && !privateKey) {
    throw Object.assign(
      new Error('Provide passwordEnvKey or privateKeyEnvKey for SFTP authentication'),
      { code: 'NOT_CONFIGURED' },
    )
  }

  const hostKeyFingerprint =
    typeof cfg.hostKeyFingerprint === 'string' ? cfg.hostKeyFingerprint.trim() : undefined
  if (env.isProd && !hostKeyFingerprint) {
    throw Object.assign(
      new Error('hostKeyFingerprint is required for live SFTP in production'),
      { code: 'NOT_CONFIGURED' },
    )
  }

  return {
    host,
    port,
    username,
    password: password ?? undefined,
    privateKey: privateKey ?? undefined,
    passphrase,
    hostKeyFingerprint,
  }
}

function remoteDir(ctx: BankConnectorAdapterContext): string {
  const remote =
    typeof ctx.configJson?.remotePath === 'string' ? ctx.configJson.remotePath.trim() : ''
  return remote || '/'
}

export function createSftpLiveAdapter(providerCode: BankConnectorProviderCode): BankConnectorAdapter {
  return {
    providerCode,
    async testConnection(ctx) {
      const client = getSftpClientFactory()()
      try {
        const opts = buildConnectOptions(ctx)
        await client.connect(opts)
        await client.list(remoteDir(ctx))
        await client.end()
        return {
          ok: true as const,
          code: 'OK' as const,
          message: `SFTP reachable at ${opts.host}:${opts.port}`,
        }
      } catch (e) {
        try {
          await client.end()
        } catch {
          /* ignore */
        }
        const code = (e as { code?: string }).code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'ERROR'
        return {
          ok: false as const,
          code: code as 'NOT_CONFIGURED' | 'ERROR',
          message: e instanceof Error ? e.message : 'SFTP probe failed',
        }
      }
    },

    async listRemoteFiles(ctx): Promise<BankConnectorRemoteFile[]> {
      const client = getSftpClientFactory()()
      try {
        await client.connect(buildConnectOptions(ctx))
        const dir = remoteDir(ctx)
        const pattern =
          typeof ctx.configJson?.fileNamePattern === 'string'
            ? ctx.configJson.fileNamePattern
            : undefined
        const entries = await client.list(dir)
        const files: BankConnectorRemoteFile[] = []
        for (const entry of entries) {
          if (entry.type !== '-' && entry.type !== 'file') continue
          if (!matchPattern(entry.name, pattern)) continue
          const path = dir.endsWith('/') ? `${dir}${entry.name}` : `${dir}/${entry.name}`
          files.push({
            name: entry.name,
            path,
            sizeBytes: entry.size,
            modifiedAt: entry.modifyTime
              ? new Date(entry.modifyTime).toISOString()
              : undefined,
          })
        }
        await client.end()
        return files.sort((a, b) => a.name.localeCompare(b.name))
      } catch (e) {
        try {
          await client.end()
        } catch {
          /* ignore */
        }
        throw e
      }
    },

    async fetchStatementFile(ctx, remotePath: string): Promise<BankConnectorFetchedFile> {
      const client = getSftpClientFactory()()
      try {
        await client.connect(buildConnectOptions(ctx))
        const buffer = await client.get(remotePath)
        await client.end()
        const expected =
          typeof ctx.configJson?.expectedFormat === 'string'
            ? ctx.configJson.expectedFormat
            : undefined
        return {
          buffer,
          fileName: remotePath.split('/').pop() || 'statement.dat',
          formatHint: formatHint(ctx.provider, expected),
        }
      } catch (e) {
        try {
          await client.end()
        } catch {
          /* ignore */
        }
        throw e
      }
    },
  }
}

/** Exported for fingerprint unit checks in tests. */
export function sha256HostKeyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('base64')
}
