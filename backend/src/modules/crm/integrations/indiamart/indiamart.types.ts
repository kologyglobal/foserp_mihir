/**
 * IndiaMART Pull API v2 contract (documented):
 * https://help.indiamart.com/knowledge-base/lms-crm-integration-v2/
 *
 * Endpoint (default): https://mapi.indiamart.com/wservce/crm/crmListing/v2/
 * Auth: query parameter `glusr_crm_key`
 * Date filters: `start_time`, `end_time` (IST; DD-Mon-YYYY or DD-MM-YYYYHH:MM:SS)
 * Min interval between hits: 5 minutes
 * Max range: 7 days per request; last 365 days available
 * Idempotency key: UNIQUE_QUERY_ID
 *
 * Always-present response fields (per IndiaMART docs):
 * UNIQUE_QUERY_ID, QUERY_TYPE, QUERY_TIME, SENDER_NAME,
 * SENDER_MOBILE or SENDER_EMAIL, SENDER_COUNTRY_ISO
 *
 * Additional fields are mapped via configurable aliases — never invent undocumented required params.
 */

export const INDIAMART_EXTERNAL_SOURCE = 'INDIAMART' as const
export const INDIAMART_LEAD_SOURCE_CODE = 'indiamart' as const
export const INDIAMART_APPROVED_HOSTS = ['mapi.indiamart.com'] as const

export const DEFAULT_INDIAMART_API_BASE_URL = 'https://mapi.indiamart.com'
export const DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT = '/wservce/crm/crmListing/v2/'

export const DEFAULT_QUERY_PARAM_NAMES = {
  apiKey: 'glusr_crm_key',
  startTime: 'start_time',
  endTime: 'end_time',
} as const

/** Documented + commonly observed response keys (aliases resolved in normalizer). */
export const DEFAULT_RESPONSE_FIELD_MAP = {
  externalEnquiryId: ['UNIQUE_QUERY_ID', 'unique_query_id'],
  enquiryDate: ['QUERY_TIME', 'query_time'],
  buyerName: ['SENDER_NAME', 'sender_name'],
  buyerCompanyName: ['SENDER_COMPANY', 'sender_company', 'COMPANY_NAME'],
  buyerMobile: ['SENDER_MOBILE', 'sender_mobile', 'MOBILE'],
  buyerAlternateMobile: ['SENDER_MOBILE_ALT', 'sender_mobile_alt', 'SENDER_PHONE'],
  buyerEmail: ['SENDER_EMAIL', 'sender_email', 'EMAIL'],
  buyerAddress: ['SENDER_ADDRESS', 'sender_address', 'ADDRESS'],
  buyerCity: ['SENDER_CITY', 'sender_city', 'CITY'],
  buyerState: ['SENDER_STATE', 'sender_state', 'STATE'],
  buyerCountry: ['SENDER_COUNTRY_ISO', 'sender_country_iso', 'COUNTRY_ISO', 'SENDER_COUNTRY'],
  buyerPincode: ['SENDER_PINCODE', 'SENDER_PINCODE_CODE', 'sender_pincode', 'PINCODE'],
  subject: ['SUBJECT', 'subject', 'QUERY_SUBJECT'],
  requirementText: ['QUERY_MESSAGE', 'query_message', 'ENQ_MESSAGE', 'MESSAGE'],
  productName: ['QUERY_PRODUCT_NAME', 'query_product_name', 'PRODUCT_NAME', 'PRODUCTNAME'],
  productCategory: ['QUERY_MCAT_NAME', 'query_mcat_name', 'MCAT_NAME'],
  quantityText: ['QUERY_QTY', 'query_qty', 'QUANTITY'],
  sourceType: ['QUERY_TYPE', 'query_type'],
  sourceUrl: ['CALL_DURATION', 'ENQ_URL', 'SOURCE_URL'],
} as const

export type IndiaMartConnectionConfig = {
  apiBaseUrl: string
  leadFetchEndpoint: string
  authenticationType: 'QUERY_PARAMETER' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'CUSTOM'
  credentials: {
    apiKey: string
    registeredMobile?: string
    registeredEmail?: string
  }
  queryParamNames?: {
    apiKey?: string
    startTime?: string
    endTime?: string
  }
  headerNames?: {
    apiKey?: string
    authorization?: string
  }
  responseFieldMap?: Partial<Record<keyof typeof DEFAULT_RESPONSE_FIELD_MAP, string[]>>
  requestTimeoutMs?: number
  maxPageSize?: number
}

export type IndiaMartFetchRequest = {
  startTime?: Date
  endTime?: Date
  /** When true, omit date params (IndiaMART returns since last hit / last 24h). */
  incrementalSinceLastHit?: boolean
}

export type IndiaMartConnectionTestResult = {
  ok: boolean
  statusCode?: number
  message: string
  recordsSampled?: number
  errorCode?: string
}

export type IndiaMartFetchResult = {
  records: unknown[]
  totalRecords?: number
  code?: number | string
  status?: string
  message?: string
  raw: unknown
}

export type IndiaMartNormalizedEnquiry = {
  externalEnquiryId: string
  enquiryDate: Date | null
  buyerName: string | null
  buyerCompanyName: string | null
  buyerMobile: string | null
  buyerAlternateMobile: string | null
  buyerEmail: string | null
  buyerAddress: string | null
  buyerCity: string | null
  buyerState: string | null
  buyerCountry: string | null
  buyerPincode: string | null
  subject: string | null
  requirementText: string | null
  productName: string | null
  productCategory: string | null
  quantityText: string | null
  quantityValue: number | null
  quantityUom: string | null
  estimatedOrderValue: number | null
  sourceType: string | null
  sourceUrl: string | null
  senderIp: string | null
  rawPayload: unknown
}

export interface IndiaMartProviderAdapter {
  testConnection(config: IndiaMartConnectionConfig): Promise<IndiaMartConnectionTestResult>
  fetchEnquiries(
    config: IndiaMartConnectionConfig,
    request: IndiaMartFetchRequest,
  ): Promise<IndiaMartFetchResult>
  normalizeEnquiry(rawPayload: unknown): IndiaMartNormalizedEnquiry
}

export type IndiaMartConfigurationJson = {
  queryParamNames?: IndiaMartConnectionConfig['queryParamNames']
  headerNames?: IndiaMartConnectionConfig['headerNames']
  responseFieldMap?: IndiaMartConnectionConfig['responseFieldMap']
  requestTimeoutMs?: number
  maxPageSize?: number
  overlapMinutes?: number
  autoCreateFollowUp?: boolean
  followUpActivityType?: string
  followUpDueMinutes?: number
  followUpSubject?: string
  followUpPriority?: string
  firstResponseSlaMinutes?: number
  escalationSlaMinutes?: number
  roundRobinUserIds?: string[]
  roundRobinCursor?: number
  territoryRules?: Array<{
    id: string
    priority: number
    active: boolean
    conditionType: 'city' | 'state' | 'territory' | 'product'
    conditionValue: string
    assignedUserId: string
    fallbackUserId?: string
  }>
  highValueThreshold?: number
  approvedHostsOverride?: string[]
}
