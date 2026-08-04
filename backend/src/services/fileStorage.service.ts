import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'

const BASE_DIR = env.CRM_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'crm')
const TREASURY_STATEMENT_BASE_DIR =
  env.TREASURY_STATEMENT_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'treasury-statements')

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

export async function saveTreasuryStatementFile(
  tenantId: string,
  fileId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const dir = path.join(TREASURY_STATEMENT_BASE_DIR, tenantId)
  await mkdir(dir, { recursive: true })
  const filename = `${fileId}${ext}`
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, buffer)
  return path.join(tenantId, filename).replace(/\\/g, '/')
}

export async function readTreasuryStatementFile(storageKey: string): Promise<Buffer> {
  const fullPath = path.join(TREASURY_STATEMENT_BASE_DIR, storageKey)
  return readFile(fullPath)
}

export async function saveDispatchPodFile(
  tenantId: string,
  attachmentId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const base = path.join(process.cwd(), 'uploads', 'dispatch-pod')
  const dir = path.join(base, tenantId)
  await mkdir(dir, { recursive: true })
  const filename = `${attachmentId}${ext}`
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, buffer)
  return path.join(tenantId, filename).replace(/\\/g, '/')
}

export async function readDispatchPodFile(storageKey: string): Promise<Buffer> {
  const base = path.join(process.cwd(), 'uploads', 'dispatch-pod')
  return readFile(path.join(base, storageKey))
}

const ITEM_IMAGE_BASE_DIR = path.join(process.cwd(), 'uploads', 'items')

export async function saveItemImageFile(
  tenantId: string,
  itemId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const dir = path.join(ITEM_IMAGE_BASE_DIR, tenantId)
  await mkdir(dir, { recursive: true })
  const safeExt = ext && ext.startsWith('.') ? ext.slice(0, 20) : '.jpg'
  const filename = `${itemId}${safeExt}`
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, buffer)
  return path.join(tenantId, filename).replace(/\\/g, '/')
}

export async function readItemImageFile(storageKey: string): Promise<Buffer> {
  return readFile(path.join(ITEM_IMAGE_BASE_DIR, storageKey))
}

export function itemImageContentType(storageKey: string): string {
  const lower = storageKey.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

const KB_BASE_DIR = env.KB_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'knowledge')

/** Persist a knowledge document binary under `{tenantId}/{documentId}{ext}`. Returns relative storageKey. */
export async function saveKnowledgeDocumentFile(
  tenantId: string,
  documentId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const dir = path.join(KB_BASE_DIR, tenantId)
  await mkdir(dir, { recursive: true })
  const safeExt = ext && ext.startsWith('.') ? ext.slice(0, 32) : ext ? `.${ext.slice(0, 31)}` : ''
  const filename = `${documentId}${safeExt}`
  const fullPath = path.join(dir, filename)
  await writeFile(fullPath, buffer)
  return path.join(tenantId, filename).replace(/\\/g, '/')
}

export async function readKnowledgeDocumentFile(storageKey: string): Promise<Buffer> {
  return readFile(path.join(KB_BASE_DIR, storageKey))
}

export async function knowledgeDocumentAbsolutePath(storageKey: string): Promise<string> {
  return path.join(KB_BASE_DIR, storageKey)
}
