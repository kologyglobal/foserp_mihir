import { environment } from './environment'

export const featureFlags = {
  apiMode: environment.useApi,
  /** CRM + masters hydrate from backend when true */
  liveCrm: environment.useApi,
  liveMasters: environment.useApi,
} as const

export type FeatureFlags = typeof featureFlags
