import { useCallback, useState } from 'react'
import { notify } from '@/store/toastStore'
import {
  cancelStandingInstruction,
  generateDueDrafts,
  pauseStandingInstruction,
  resumeStandingInstruction,
} from '../api/standing-instruction.api'
import type { GenerateDueDraftsInput, GenerationOutcomeDto, StandingInstructionDto } from '../api/standing-instruction.types'

export function useStandingInstructionMutations(
  instruction: StandingInstructionDto | null,
  onUpdated: (updated: StandingInstructionDto) => void,
) {
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (label: string, action: () => Promise<StandingInstructionDto>) => {
      setBusy(true)
      try {
        const updated = await action()
        notify.success(label)
        onUpdated(updated)
        return updated
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
        throw e
      } finally {
        setBusy(false)
      }
    },
    [onUpdated],
  )

  const pause = useCallback(() => {
    if (!instruction) return Promise.reject(new Error('No standing instruction'))
    return run('Standing instruction paused', () => pauseStandingInstruction(instruction.id, { expectedUpdatedAt: instruction.updatedAt }))
  }, [instruction, run])

  const resume = useCallback(() => {
    if (!instruction) return Promise.reject(new Error('No standing instruction'))
    return run('Standing instruction resumed', () => resumeStandingInstruction(instruction.id, { expectedUpdatedAt: instruction.updatedAt }))
  }, [instruction, run])

  const cancel = useCallback(
    (reason: string) => {
      if (!instruction) return Promise.reject(new Error('No standing instruction'))
      return run('Standing instruction cancelled', () =>
        cancelStandingInstruction(instruction.id, { expectedUpdatedAt: instruction.updatedAt, reason }),
      )
    },
    [instruction, run],
  )

  return { busy, pause, resume, cancel }
}

/** Standalone mutation for the "Generate due drafts" action shared by list + detail pages. */
export function useGenerateDueDrafts() {
  const [busy, setBusy] = useState(false)

  const generate = useCallback(async (input: GenerateDueDraftsInput): Promise<GenerationOutcomeDto[]> => {
    setBusy(true)
    try {
      const outcomes = await generateDueDrafts(input)
      const created = outcomes.filter((o) => o.status === 'DRAFT_CREATED').length
      const skipped = outcomes.filter((o) => o.status === 'SKIPPED').length
      const failed = outcomes.filter((o) => o.status === 'FAILED').length
      notify.success(`Generated ${created} draft(s)${skipped ? `, ${skipped} skipped` : ''}${failed ? `, ${failed} failed` : ''}`)
      return outcomes
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to generate due drafts')
      throw e
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, generate }
}
