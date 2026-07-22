/**
 * Injectable SFTP client factory — production uses ssh2-sftp-client; tests inject a mock.
 */
export interface SftpListEntry {
  name: string
  type: string
  size: number
  modifyTime?: number
}

export interface SftpConnectOptions {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string | Buffer
  passphrase?: string
  hostKeyFingerprint?: string
  readyTimeout?: number
}

export interface SftpClientHandle {
  connect(opts: SftpConnectOptions): Promise<void>
  list(remotePath: string): Promise<SftpListEntry[]>
  get(remotePath: string): Promise<Buffer>
  end(): Promise<void>
}

export type SftpClientFactory = () => SftpClientHandle

let factory: SftpClientFactory = createDefaultSftpClient

export function setSftpClientFactoryForTests(fn: SftpClientFactory | null): void {
  factory = fn ?? createDefaultSftpClient
}

export function getSftpClientFactory(): SftpClientFactory {
  return factory
}

function createDefaultSftpClient(): SftpClientHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ssh2-sftp-client default export typing incomplete under NodeNext
  let client: any = null

  return {
    async connect(opts) {
      const { default: SftpClient } = await import('ssh2-sftp-client')
      client = new SftpClient()
      const connectOpts: Record<string, unknown> = {
        host: opts.host,
        port: opts.port,
        username: opts.username,
        readyTimeout: opts.readyTimeout ?? 15_000,
      }
      if (opts.password) connectOpts.password = opts.password
      if (opts.privateKey) connectOpts.privateKey = opts.privateKey
      if (opts.passphrase) connectOpts.passphrase = opts.passphrase
      if (opts.hostKeyFingerprint) {
        const { createHash } = await import('node:crypto')
        connectOpts.hostVerifier = (key: Buffer) => {
          const fp = createHash('sha256').update(key).digest('base64')
          const expected = opts.hostKeyFingerprint!.replace(/^SHA256:/i, '').trim()
          return fp === expected || `SHA256:${fp}` === opts.hostKeyFingerprint
        }
      }
      await client.connect(connectOpts as never)
    },
    async list(remotePath) {
      if (!client) throw new Error('SFTP client not connected')
      return (await client.list(remotePath)) as SftpListEntry[]
    },
    async get(remotePath) {
      if (!client) throw new Error('SFTP client not connected')
      const data = await client.get(remotePath)
      if (Buffer.isBuffer(data)) return data
      if (typeof data === 'string') return Buffer.from(data)
      throw new Error('Unexpected SFTP get() result type')
    },
    async end() {
      if (client) {
        await client.end()
        client = null
      }
    },
  }
}
