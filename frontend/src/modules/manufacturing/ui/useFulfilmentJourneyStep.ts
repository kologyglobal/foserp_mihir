/**
 * Persist Fulfilment journey step in the URL (`?step=`) across refresh.
 * URL wins when present; otherwise the derived coach step is shown (not auto-written).
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FulfilmentJourneyStepId } from './FulfilmentJourneyStrip'
import { parseFulfilmentJourneyStep } from './fulfilmentJourneyUrl'

export function useFulfilmentJourneyStep(derivedActive: FulfilmentJourneyStepId) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStep = parseFulfilmentJourneyStep(searchParams.get('step'))

  const step = urlStep ?? derivedActive

  const setStep = useCallback(
    (next: FulfilmentJourneyStepId, opts?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams)
      params.set('step', next)
      setSearchParams(params, { replace: opts?.replace ?? true })
    },
    [searchParams, setSearchParams],
  )

  return useMemo(() => ({ step, urlStep, setStep }), [step, urlStep, setStep])
}
