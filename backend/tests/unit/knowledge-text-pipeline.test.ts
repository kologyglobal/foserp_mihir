import { describe, expect, it } from 'vitest'
import {
  chunkMarkdown,
  contentHash,
  cosineSimilarity,
  localHashEmbed,
} from '../../src/modules/knowledge/indexing/text-pipeline.js'

describe('knowledge text pipeline', () => {
  it('chunks markdown by headings and size', () => {
    const md = `# Intro\n${'word '.repeat(400)}\n## Next\nshort`
    const chunks = chunkMarkdown(md, { chunkSize: 200, overlap: 40 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]!.chunkIndex).toBe(0)
    expect(chunks.every((c) => c.contentMd.trim().length > 0)).toBe(true)
  })

  it('produces stable content hashes', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'))
    expect(contentHash('abc')).not.toBe(contentHash('abd'))
  })

  it('local embeddings are unit-ish and similar for similar text', () => {
    const a = localHashEmbed('safety procedure lockout tagout')
    const b = localHashEmbed('safety procedure lockout tagout steps')
    const c = localHashEmbed('completely unrelated dessert recipe chocolate')
    expect(a).toHaveLength(384)
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c))
  })
})
