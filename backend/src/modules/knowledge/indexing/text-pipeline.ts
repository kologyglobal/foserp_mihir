import { createHash } from 'node:crypto'
import { parse as parseCsv } from 'csv-parse/sync'
import ExcelJS from 'exceljs'
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  KNOWLEDGE_LOCAL_EMBEDDING_DIM,
  KNOWLEDGE_LOCAL_EMBEDDING_MODEL,
} from '../knowledge.constants.js'

export type ExtractedDocument = {
  markdown: string
  /** Human-readable extractor name for logs. */
  extractor: string
  warnings: string[]
}

export type TextChunk = {
  chunkIndex: number
  contentMd: string
  headingPath: string | null
  charStart: number
  charEnd: number
  tokenCount: number
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function extOf(filename: string | null | undefined): string {
  if (!filename) return ''
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i).toLowerCase() : ''
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const parts: string[] = []
  workbook.eachSheet((sheet) => {
    parts.push(`## ${sheet.name}`)
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[])
        .slice(1)
        .map((v) => (v == null ? '' : String(v)))
        .filter(Boolean)
      if (cells.length) parts.push(cells.join(' | '))
    })
    parts.push('')
  })
  return parts.join('\n').trim()
}

function extractCsv(buffer: Buffer): string {
  const text = buffer.toString('utf8')
  const rows = parseCsv(text, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  }) as string[][]
  return rows.map((r) => r.join(' | ')).join('\n')
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse is CJS; import shape varies under NodeNext.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = (await import('pdf-parse')).default as unknown as (
    data: Buffer,
  ) => Promise<{ text?: string }>
  const result = await pdfParse(buffer)
  return (result.text ?? '').trim()
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return (result.value ?? '').trim()
}

/**
 * Convert stored bytes into Markdown-ish plain text suitable for chunking.
 * OCR is not implemented (image → FAILED guidance when OCR not available).
 */
export async function extractToMarkdown(input: {
  buffer: Buffer | null
  mimeType: string | null
  originalFilename: string | null
  sourceUrl: string | null
  existingMarkdown: string | null
  ocrEnabled: boolean
}): Promise<ExtractedDocument> {
  const warnings: string[] = []

  if (input.existingMarkdown?.trim() && !input.buffer) {
    return {
      markdown: input.existingMarkdown.trim(),
      extractor: 'version-markdown',
      warnings,
    }
  }

  if (!input.buffer && input.sourceUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch(input.sourceUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FOS-ERP-Knowledge/1.0' },
      })
      clearTimeout(timer)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const ctype = res.headers.get('content-type') ?? 'text/html'
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 5 * 1024 * 1024) {
        throw new Error('Remote document exceeds 5MB fetch limit')
      }
      const nested = await extractToMarkdown({
        buffer: buf,
        mimeType: ctype.split(';')[0]?.trim() ?? null,
        originalFilename: input.originalFilename ?? new URL(input.sourceUrl).pathname,
        sourceUrl: null,
        existingMarkdown: null,
        ocrEnabled: input.ocrEnabled,
      })
      return {
        markdown: nested.markdown,
        extractor: `url+${nested.extractor}`,
        warnings: [...warnings, ...nested.warnings],
      }
    } catch (err) {
      throw new Error(
        `Failed to fetch source URL: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (!input.buffer) {
    if (input.existingMarkdown?.trim()) {
      return { markdown: input.existingMarkdown.trim(), extractor: 'version-markdown', warnings }
    }
    throw new Error('No file, URL, or markdown content available to extract')
  }

  const ext = extOf(input.originalFilename)
  const mime = (input.mimeType ?? '').toLowerCase()
  const buf = input.buffer

  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    if (!input.ocrEnabled) {
      throw new Error(
        'Image OCR is disabled. Set KB_OCR_ENABLED=true and configure an OCR provider in a later release, or upload text/PDF/DOCX.',
      )
    }
    throw new Error('OCR is not wired yet. Convert the image to PDF/text and re-upload.')
  }

  if (ext === '.pdf' || mime === 'application/pdf') {
    const text = await extractPdf(buf)
    if (!text) warnings.push('PDF produced empty text (may be scanned/image-only)')
    return { markdown: text || '_Empty PDF extract_', extractor: 'pdf-parse', warnings }
  }

  if (
    ext === '.docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const text = await extractDocx(buf)
    return { markdown: text || '_Empty DOCX extract_', extractor: 'mammoth', warnings }
  }

  if (ext === '.doc' || mime === 'application/msword') {
    throw new Error('Legacy .doc is not supported. Convert to .docx or PDF and re-upload.')
  }

  if (
    ext === '.xlsx' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    const text = await extractXlsx(buf)
    return { markdown: text || '_Empty spreadsheet_', extractor: 'exceljs', warnings }
  }

  if (ext === '.xls' || mime === 'application/vnd.ms-excel') {
    throw new Error('Legacy .xls is not supported. Convert to .xlsx and re-upload.')
  }

  if (ext === '.csv' || mime === 'text/csv') {
    return { markdown: extractCsv(buf), extractor: 'csv-parse', warnings }
  }

  if (ext === '.html' || ext === '.htm' || mime.includes('html')) {
    return { markdown: stripHtml(buf.toString('utf8')), extractor: 'html-strip', warnings }
  }

  if (ext === '.json' || mime.includes('json')) {
    try {
      const obj = JSON.parse(buf.toString('utf8'))
      return {
        markdown: '```json\n' + JSON.stringify(obj, null, 2) + '\n```',
        extractor: 'json',
        warnings,
      }
    } catch {
      return { markdown: buf.toString('utf8'), extractor: 'json-raw', warnings }
    }
  }

  // txt / md / unknown text
  const text = buf.toString('utf8').replace(/^\uFEFF/, '')
  return {
    markdown: text,
    extractor: ext === '.md' || ext === '.markdown' ? 'markdown' : 'text',
    warnings,
  }
}

export function chunkMarkdown(
  markdown: string,
  opts?: { chunkSize?: number; overlap?: number },
): TextChunk[] {
  const chunkSize = Math.max(200, opts?.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const overlap = Math.min(Math.max(0, opts?.overlap ?? DEFAULT_CHUNK_OVERLAP), Math.floor(chunkSize / 2))
  const text = markdown.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  // Prefer splitting on headings then paragraphs.
  const sections = text.split(/(?=^#{1,6}\s)/m).filter((s) => s.trim())
  const pieces: Array<{ heading: string | null; body: string }> = []

  for (const section of sections) {
    const lines = section.split('\n')
    const headingMatch = lines[0]?.match(/^#{1,6}\s+(.+)$/)
    const heading = headingMatch?.[1]?.trim() ?? null
    const body = headingMatch ? lines.slice(1).join('\n').trim() : section.trim()
    if (!body && heading) {
      pieces.push({ heading, body: heading })
    } else if (body) {
      pieces.push({ heading, body })
    }
  }

  if (pieces.length === 0) pieces.push({ heading: null, body: text })

  const chunks: TextChunk[] = []
  let globalOffset = 0

  const pushChunk = (content: string, heading: string | null, start: number) => {
    const contentMd = content.trim()
    if (!contentMd) return
    const end = start + contentMd.length
    chunks.push({
      chunkIndex: chunks.length,
      contentMd,
      headingPath: heading,
      charStart: start,
      charEnd: end,
      tokenCount: Math.ceil(contentMd.length / 4),
    })
  }

  for (const piece of pieces) {
    const body = piece.body
    if (body.length <= chunkSize) {
      pushChunk(body, piece.heading, globalOffset)
      globalOffset += body.length + 1
      continue
    }

    let start = 0
    while (start < body.length) {
      let end = Math.min(start + chunkSize, body.length)
      if (end < body.length) {
        const slice = body.slice(start, end)
        const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf(' '))
        if (breakAt > chunkSize * 0.4) {
          end = start + breakAt
        }
      }
      pushChunk(body.slice(start, end), piece.heading, globalOffset + start)
      if (end >= body.length) break
      start = Math.max(end - overlap, start + 1)
    }
    globalOffset += body.length + 1
  }

  return chunks
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Deterministic local embedding so search works without OPENAI_API_KEY. */
export function localHashEmbed(text: string, dim = KNOWLEDGE_LOCAL_EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)

  for (const token of tokens) {
    const h = createHash('sha256').update(token).digest()
    const idx = h.readUInt32BE(0) % dim
    const sign = h[4]! & 1 ? 1 : -1
    vec[idx]! += sign
  }

  // L2 normalize
  let sum = 0
  for (const v of vec) sum += v * v
  const norm = Math.sqrt(sum) || 1
  return vec.map((v) => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

export function localEmbeddingModelId(): string {
  return KNOWLEDGE_LOCAL_EMBEDDING_MODEL
}
