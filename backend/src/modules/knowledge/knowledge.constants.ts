/** Knowledge Base / OpenKB constants. */

export const KNOWLEDGE_MODULE_KEY = 'knowledge' as const

/** Current product wave (5 = Copilot global shell + ERP context). */
export const KNOWLEDGE_WAVE = 5 as const

/** Feature flags exposed on GET /kb/status. */
export const KNOWLEDGE_FEATURES = {
  documents: true,
  indexing: true,
  search: true,
  chat: true,
  copilot: true,
  insights: false,
  admin: false,
} as const

/** @deprecated use KNOWLEDGE_FEATURES */
export const KNOWLEDGE_STUB_FEATURES = KNOWLEDGE_FEATURES

export type KnowledgeDocumentStatusName =
  | 'DRAFT'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'ARCHIVED'

/** Allowed status transitions for the document lifecycle machine. */
export const KNOWLEDGE_STATUS_TRANSITIONS: Record<
  KnowledgeDocumentStatusName,
  readonly KnowledgeDocumentStatusName[]
> = {
  DRAFT: ['PROCESSING', 'READY', 'ARCHIVED'],
  PROCESSING: ['READY', 'FAILED', 'DRAFT'],
  READY: ['PROCESSING', 'DRAFT', 'ARCHIVED'],
  FAILED: ['PROCESSING', 'DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
}

/** MIME allow-list. */
export const KNOWLEDGE_ALLOWED_MIME: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/octet-stream',
])

export const KNOWLEDGE_ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
])

/** Local bag-of-words embedding dimensions (used when OpenAI is not configured). */
export const KNOWLEDGE_LOCAL_EMBEDDING_DIM = 384
export const KNOWLEDGE_LOCAL_EMBEDDING_MODEL = 'kb-local-hash-v1'

export const DEFAULT_CHUNK_SIZE = 1200
export const DEFAULT_CHUNK_OVERLAP = 200
export const DEFAULT_SEARCH_TOP_K = 10
export const MAX_SEARCH_TOP_K = 50
/** Safety cap for in-memory similarity scan per request. */
export const MAX_SEMANTIC_SCAN_CHUNKS = 2000
