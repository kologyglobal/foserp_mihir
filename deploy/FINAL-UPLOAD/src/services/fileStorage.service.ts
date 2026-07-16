import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'

const BASE_DIR = env.CRM_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'crm')

export async function saveCrmAttachmentFile(
  tenantId: string,
  attachmentId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const dir = path.join(BASE_DIR, tenantId)
  await mkdir(dir, { recursive: true })
  const filename = `${attachmentId}${ext}`
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, buffer)
  return path.join(tenantId, filename).replace(/\\/g, '/')
}

export async function readCrmAttachmentFile(storageKey: string): Promise<Buffer> {
  const fullPath = path.join(BASE_DIR, storageKey)
  return readFile(fullPath)
}

export function getAttachmentExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx) : ''
}
