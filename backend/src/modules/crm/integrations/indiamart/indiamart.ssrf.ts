import {
  INDIAMART_APPROVED_HOSTS,
  type IndiaMartConfigurationJson,
  type IndiaMartConnectionConfig,
} from './indiamart.types.js'
import { IndiaMartError } from './indiamart.errors.js'

export function assertSafeIndiaMartUrl(
  apiBaseUrl: string,
  approvedHosts: readonly string[] = INDIAMART_APPROVED_HOSTS,
): URL {
  let url: URL
  try {
    url = new URL(apiBaseUrl)
  } catch {
    throw new IndiaMartError('SSRF_BLOCKED', 'Invalid IndiaMART API base URL')
  }
  if (url.protocol !== 'https:') {
    throw new IndiaMartError('SSRF_BLOCKED', 'IndiaMART API base URL must use HTTPS')
  }
  const host = url.hostname.toLowerCase()
  if (!approvedHosts.includes(host)) {
    throw new IndiaMartError(
      'SSRF_BLOCKED',
      `Host "${host}" is not an approved IndiaMART API host`,
      400,
      { approvedHosts },
    )
  }
  return url
}

export function buildFetchUrl(
  config: IndiaMartConnectionConfig,
  params: Record<string, string>,
): string {
  const cfg = (config as IndiaMartConnectionConfig & { configurationJson?: IndiaMartConfigurationJson })
  const approved =
    (cfg as { approvedHostsOverride?: string[] }).approvedHostsOverride ?? INDIAMART_APPROVED_HOSTS
  const base = assertSafeIndiaMartUrl(config.apiBaseUrl, approved)
  const endpoint = config.leadFetchEndpoint.startsWith('/')
    ? config.leadFetchEndpoint
    : `/${config.leadFetchEndpoint}`
  const url = new URL(endpoint, base)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}
