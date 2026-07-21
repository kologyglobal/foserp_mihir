import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  getAllowedSandboxRoots,
  isSandboxConnectorsEnabled,
} from '../bank-connector.secrets.js'
import type {
  BankConnectorAdapter,
  BankConnectorAdapterContext,
  BankConnectorFetchedFile,
  BankConnectorRemoteFile,
  BankConnectorStatementFormatHint,
} from '../bank-connector.interface.js'
import type { BankConnectorProviderCode } from '../bank-connector.enums.js'

function formatHintFromProvider(
  provider: string,
  expected?: string,
): BankConnectorStatementFormatHint {
  if (expected === 'MT940' || expected === 'CAMT053' || expected === 'CSV' || expected === 'OTHER') {
    return expected
  }
  if (provider === 'MT940_SFTP') return 'MT940'
  if (provider === 'CAMT_SFTP') return 'CAMT053'
  return 'UNKNOWN'
}

function matchPattern(fileName: string, pattern: string | undefined): boolean {
  if (!pattern || pattern === '*') return true
  // Simple glob: *.sta / *.xml / prefix*
  if (pattern.startsWith('*.')) {
    return fileName.toLowerCase().endsWith(pattern.slice(1).toLowerCase())
  }
  if (pattern.endsWith('*')) {
    return fileName.toLowerCase().startsWith(pattern.slice(0, -1).toLowerCase())
  }
  return fileName === pattern
}

function resolveSandboxRoot(ctx: BankConnectorAdapterContext): string {
  const root = typeof ctx.configJson?.sandboxRoot === 'string' ? ctx.configJson.sandboxRoot.trim() : ''
  if (!root) {
    throw Object.assign(new Error('sandboxRoot is required for sandbox mode'), { code: 'NOT_CONFIGURED' })
  }
  const resolved = path.resolve(root)
  const allowed = getAllowedSandboxRoots()
  if (allowed.length > 0) {
    const ok = allowed.some((a) => {
      const base = path.resolve(a)
      return resolved === base || resolved.startsWith(base + path.sep)
    })
    if (!ok) {
      throw Object.assign(new Error('sandboxRoot is outside BANK_CONNECTOR_SANDBOX_ROOTS allow-list'), {
        code: 'NOT_CONFIGURED',
      })
    }
  }
  return resolved
}

export function createSandboxFsAdapter(providerCode: BankConnectorProviderCode): BankConnectorAdapter {
  return {
    providerCode,
    async testConnection(ctx) {
      if (!isSandboxConnectorsEnabled()) {
        return {
          ok: false as const,
          code: 'NOT_CONFIGURED' as const,
          message: 'Sandbox connectors are disabled (set BANK_CONNECTOR_SANDBOX_ENABLED=true)',
        }
      }
      try {
        const root = resolveSandboxRoot(ctx)
        const st = await stat(root)
        if (!st.isDirectory()) {
          return {
            ok: false as const,
            code: 'NOT_CONFIGURED' as const,
            message: `sandboxRoot is not a directory: ${root}`,
          }
        }
        return {
          ok: true as const,
          code: 'OK' as const,
          message: `Sandbox filesystem reachable at ${root}`,
        }
      } catch (e) {
        const code = (e as { code?: string }).code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'ERROR'
        return {
          ok: false as const,
          code: code as 'NOT_CONFIGURED' | 'ERROR',
          message: e instanceof Error ? e.message : 'Sandbox connection failed',
        }
      }
    },

    async listRemoteFiles(ctx): Promise<BankConnectorRemoteFile[]> {
      const root = resolveSandboxRoot(ctx)
      const pattern =
        typeof ctx.configJson?.fileNamePattern === 'string' ? ctx.configJson.fileNamePattern : undefined
      const remotePath =
        typeof ctx.configJson?.remotePath === 'string' ? ctx.configJson.remotePath.trim() : ''
      const dir = remotePath ? path.resolve(root, remotePath) : root
      if (!dir.startsWith(root)) {
        throw new Error('remotePath escapes sandboxRoot')
      }
      const entries = await readdir(dir, { withFileTypes: true })
      const files: BankConnectorRemoteFile[] = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!matchPattern(entry.name, pattern)) continue
        const full = path.join(dir, entry.name)
        const st = await stat(full)
        files.push({
          name: entry.name,
          path: path.relative(root, full).replace(/\\/g, '/'),
          sizeBytes: st.size,
          modifiedAt: st.mtime.toISOString(),
        })
      }
      return files.sort((a, b) => a.name.localeCompare(b.name))
    },

    async fetchStatementFile(ctx, remotePath: string): Promise<BankConnectorFetchedFile> {
      const root = resolveSandboxRoot(ctx)
      const full = path.resolve(root, remotePath)
      if (!full.startsWith(root + path.sep) && full !== root) {
        throw new Error('Remote path escapes sandboxRoot')
      }
      const buffer = await readFile(full)
      const expected =
        typeof ctx.configJson?.expectedFormat === 'string' ? ctx.configJson.expectedFormat : undefined
      return {
        buffer,
        fileName: path.basename(full),
        formatHint: formatHintFromProvider(ctx.provider, expected),
      }
    },
  }
}
