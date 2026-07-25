import { classifyRemoteStatus, IndiaMartError } from './indiamart.errors.js'
import { formatIndiaMartTimestamp, normalizeIndiaMartEnquiry } from './indiamart.normalizer.js'
import { buildFetchUrl } from './indiamart.ssrf.js'
import {
  DEFAULT_QUERY_PARAM_NAMES,
  type IndiaMartConnectionConfig,
  type IndiaMartConnectionTestResult,
  type IndiaMartFetchRequest,
  type IndiaMartFetchResult,
  type IndiaMartNormalizedEnquiry,
  type IndiaMartProviderAdapter,
} from './indiamart.types.js'

function extractRecords(body: unknown): { records: unknown[]; total?: number; code?: number | string; status?: string; message?: string } {
  if (Array.isArray(body)) return { records: body }
  if (!body || typeof body !== 'object') return { records: [] }
  const row = body as Record<string, unknown>
  const response = row.RESPONSE ?? row.response ?? row.DATA ?? row.data
  const records = Array.isArray(response) ? response : Array.isArray(row.leads) ? row.leads : []
  return {
    records,
    total: Number(row.TOTAL_RECORDS ?? row.total_records ?? records.length) || records.length,
    code: (row.CODE ?? row.code) as number | string | undefined,
    status: row.STATUS != null ? String(row.STATUS) : row.status != null ? String(row.status) : undefined,
    message: row.MESSAGE != null ? String(row.MESSAGE) : row.message != null ? String(row.message) : undefined,
  }
}

async function httpGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
      redirect: 'error',
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { MESSAGE: text }
    }
    return { status: res.status, body, text }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new IndiaMartError('REMOTE_TIMEOUT', 'IndiaMART API request timed out', 504)
    }
    throw new IndiaMartError('REMOTE_SERVER', `IndiaMART API request failed: ${(err as Error).message}`, 502)
  } finally {
    clearTimeout(timer)
  }
}

function authParamsAndHeaders(config: IndiaMartConnectionConfig): {
  params: Record<string, string>
  headers: Record<string, string>
} {
  const keyParam = config.queryParamNames?.apiKey ?? DEFAULT_QUERY_PARAM_NAMES.apiKey
  const headers: Record<string, string> = {}
  const params: Record<string, string> = {}

  switch (config.authenticationType) {
    case 'API_KEY_HEADER':
      headers[config.headerNames?.apiKey ?? 'X-API-Key'] = config.credentials.apiKey
      break
    case 'BEARER_TOKEN':
      headers[config.headerNames?.authorization ?? 'Authorization'] = `Bearer ${config.credentials.apiKey}`
      break
    case 'CUSTOM':
      if (config.headerNames?.apiKey) headers[config.headerNames.apiKey] = config.credentials.apiKey
      else params[keyParam] = config.credentials.apiKey
      break
    case 'QUERY_PARAMETER':
    default:
      params[keyParam] = config.credentials.apiKey
      break
  }
  return { params, headers }
}

export class IndiaMartPullApiV2Adapter implements IndiaMartProviderAdapter {
  async testConnection(config: IndiaMartConnectionConfig): Promise<IndiaMartConnectionTestResult> {
    try {
      const result = await this.fetchEnquiries(config, { incrementalSinceLastHit: true })
      const codeNum = Number(result.code)
      if (result.status?.toUpperCase() === 'FAILURE' || (Number.isFinite(codeNum) && codeNum >= 400 && codeNum !== 204)) {
        const err = classifyRemoteStatus(codeNum || 400, result.message)
        return { ok: false, statusCode: codeNum || 400, message: err.message, errorCode: err.code }
      }
      // CODE 204 = no leads in window — connection still valid
      return {
        ok: true,
        statusCode: 200,
        message: result.message || 'Connection successful',
        recordsSampled: result.records.length,
      }
    } catch (err) {
      const e = err instanceof IndiaMartError ? err : new IndiaMartError('INTERNAL', (err as Error).message, 500)
      return { ok: false, message: e.message, errorCode: e.code, statusCode: e.statusCode }
    }
  }

  async fetchEnquiries(
    config: IndiaMartConnectionConfig,
    request: IndiaMartFetchRequest,
  ): Promise<IndiaMartFetchResult> {
    const timeoutMs = config.requestTimeoutMs ?? 30_000
    const { params, headers } = authParamsAndHeaders(config)
    const startKey = config.queryParamNames?.startTime ?? DEFAULT_QUERY_PARAM_NAMES.startTime
    const endKey = config.queryParamNames?.endTime ?? DEFAULT_QUERY_PARAM_NAMES.endTime

    if (!request.incrementalSinceLastHit) {
      if (request.startTime) params[startKey] = formatIndiaMartTimestamp(request.startTime)
      if (request.endTime) params[endKey] = formatIndiaMartTimestamp(request.endTime)
    }

    const url = buildFetchUrl(config, params)
    // Never log the full URL (contains API key).
    const { status, body } = await httpGet(url, headers, timeoutMs)
    const parsed = extractRecords(body)

    if (status === 401 || status === 403) {
      throw classifyRemoteStatus(status, parsed.message)
    }
    if (status === 429) {
      throw classifyRemoteStatus(429, parsed.message)
    }
    if (status >= 500) {
      throw classifyRemoteStatus(status, parsed.message)
    }

    const codeNum = Number(parsed.code)
    if (parsed.status?.toUpperCase() === 'FAILURE' && codeNum !== 204) {
      throw classifyRemoteStatus(codeNum || status || 400, parsed.message)
    }

    return {
      records: parsed.records,
      totalRecords: parsed.total,
      code: parsed.code,
      status: parsed.status,
      message: parsed.message,
      raw: body,
    }
  }

  normalizeEnquiry(rawPayload: unknown): IndiaMartNormalizedEnquiry {
    return normalizeIndiaMartEnquiry(rawPayload)
  }
}

export function getIndiaMartProviderAdapter(): IndiaMartProviderAdapter {
  return new IndiaMartPullApiV2Adapter()
}
