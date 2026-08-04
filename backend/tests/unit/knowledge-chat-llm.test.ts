import { describe, expect, it } from 'vitest'
import {
  buildLocalExtractiveAnswer,
  buildRagSystemPrompt,
} from '../../src/modules/knowledge/chat/llm.js'

describe('knowledge chat llm helpers', () => {
  it('buildRagSystemPrompt includes numbered sources for citation style', () => {
    const prompt = buildRagSystemPrompt([
      {
        index: 1,
        documentTitle: 'Safety SOP',
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        headingPath: 'Loto / Isolation',
        content: 'Isolate energy before service.',
      },
    ])
    expect(prompt).toContain('## Retrieved sources')
    expect(prompt).toContain('[1] Safety SOP')
    expect(prompt).toContain('Cite sources inline as [1]')
    expect(prompt).toContain('Isolate energy before service.')
  })

  it('local extractive answer surfaces sources and the user question', () => {
    const system = buildRagSystemPrompt([
      {
        index: 1,
        documentTitle: 'Handbook',
        documentId: 'd1',
        chunkId: 'c1',
        headingPath: null,
        content: 'Return policies apply within 14 days.',
      },
    ])
    const answer = buildLocalExtractiveAnswer([
      { role: 'system', content: system },
      { role: 'user', content: 'What is the return window?' },
    ])
    expect(answer).toContain('Handbook')
    expect(answer).toContain('14 days')
    expect(answer).toContain('return window')
  })

  it('local extractive answer explains empty retrieval', () => {
    const answer = buildLocalExtractiveAnswer([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Anything?' },
    ])
    expect(answer.toLowerCase()).toContain('could not find')
  })
})
