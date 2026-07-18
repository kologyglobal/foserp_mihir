import { describe, expect, it } from 'vitest'
import {
  createNoteSchema,
  listNotesQuerySchema,
  updateNoteSchema,
} from '../src/modules/crm/notes/note.validation.js'
import { CRM_NOTE_TYPES } from '../src/modules/crm/notes/note.types.js'

describe('CRM note stage/type validation', () => {
  it('accepts create with stageCode and noteType', () => {
    const parsed = createNoteSchema.parse({
      content: 'Qualification context',
      stageCode: 'qualified',
      noteType: 'qualification',
    })
    expect(parsed.stageCode).toBe('qualified')
    expect(parsed.noteType).toBe('qualification')
  })

  it('allows create without stage/type (general note)', () => {
    const parsed = createNoteSchema.parse({ content: 'Plain note' })
    expect(parsed.content).toBe('Plain note')
    expect(parsed.stageCode).toBeUndefined()
    expect(parsed.noteType).toBeUndefined()
  })

  it('rejects unknown noteType', () => {
    expect(() =>
      createNoteSchema.parse({
        content: 'x',
        noteType: 'not_a_real_type',
      }),
    ).toThrow()
  })

  it('update schema is content-only (stage identity immutable)', () => {
    const parsed = updateNoteSchema.parse({ content: 'Edited body' })
    expect(parsed).toEqual({ content: 'Edited body' })
    expect('stageCode' in parsed).toBe(false)
    expect('noteType' in parsed).toBe(false)
    // Unknown keys are stripped — cannot mutate stage via PATCH body
    const stripped = updateNoteSchema.parse({
      content: 'Edited body',
      stageCode: 'should_be_ignored',
      noteType: 'qualification',
    } as { content: string })
    expect(stripped).toEqual({ content: 'Edited body' })
  })

  it('list query filters stageCode and noteType', () => {
    const parsed = listNotesQuerySchema.parse({
      stageCode: 'qualified',
      noteType: 'qualification',
    })
    expect(parsed.stageCode).toBe('qualified')
    expect(parsed.noteType).toBe('qualification')
  })

  it('exposes stable note type codes', () => {
    expect(CRM_NOTE_TYPES).toContain('general')
    expect(CRM_NOTE_TYPES).toContain('disqualification')
    expect(CRM_NOTE_TYPES).toHaveLength(8)
  })
})
