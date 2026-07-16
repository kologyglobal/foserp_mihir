import type {
  QcAutoDecision,
  QcParameterResult,
  QcParameterSeverity,
  QcSubmissionValidation,
} from '../types/qcParameters'

function isValueProvided(result: QcParameterResult): boolean {
  const v = result.actualValue
  if (v === null || v === undefined) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (result.parameterType === 'photo_required') return !!result.attachmentRef?.trim()
  return true
}

export function evaluateSingleParameter(result: QcParameterResult): boolean | null {
  if (!isValueProvided(result)) return null

  switch (result.passFailRule) {
    case 'boolean_true':
      return result.actualValue === true
    case 'boolean_false':
      return result.actualValue === false
    case 'numeric_tolerance': {
      const num = typeof result.actualValue === 'number' ? result.actualValue : Number(result.actualValue)
      if (Number.isNaN(num)) return false
      if (result.minValue != null && num < result.minValue) return false
      if (result.maxValue != null && num > result.maxValue) return false
      return true
    }
    case 'manual':
      if (result.parameterType === 'photo_required') return !!result.attachmentRef?.trim()
      if (result.parameterType === 'dropdown') {
        return result.actualValue !== 'Reject'
      }
      if (result.parameterType === 'text') return !!String(result.actualValue ?? '').trim()
      return result.passed ?? true
    default:
      return result.passed ?? null
  }
}

export function applyParameterEvaluation(results: QcParameterResult[]): QcParameterResult[] {
  return results.map((r) => {
    const passed = evaluateSingleParameter(r)
    return { ...r, passed }
  })
}

function worstSeverity(severities: QcParameterSeverity[]): QcParameterSeverity | null {
  if (severities.includes('critical')) return 'critical'
  if (severities.includes('major')) return 'major'
  if (severities.includes('minor')) return 'minor'
  return null
}

export function deriveAutoDecision(evaluated: QcParameterResult[]): QcAutoDecision {
  const failed = evaluated.filter((r) => r.passed === false)
  if (failed.length === 0) return 'pass'
  const worst = worstSeverity(failed.map((f) => f.severity))
  if (worst === 'critical' || worst === 'major') return 'reject'
  return 'rework'
}

export function validateQcSubmission(results: QcParameterResult[]): QcSubmissionValidation {
  const errors: string[] = []
  const evaluated = applyParameterEvaluation(results)

  for (const r of evaluated) {
    if (r.mandatory && !isValueProvided(r)) {
      errors.push(`Mandatory parameter missing: ${r.parameterName}`)
    }
    if (r.parameterType === 'photo_required' && r.mandatory && !r.attachmentRef?.trim()) {
      errors.push(`Photo required: ${r.parameterName}`)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, autoDecision: null, failedParameters: evaluated.filter((r) => r.passed === false) }
  }

  const failedParameters = evaluated.filter((r) => r.passed === false)
  const autoDecision = deriveAutoDecision(evaluated)

  return { ok: true, errors: [], autoDecision, failedParameters }
}

export function ncrSeverityFromFailed(failed: QcParameterResult[]): QcParameterSeverity {
  const worst = worstSeverity(failed.map((f) => f.severity))
  return worst ?? 'major'
}
