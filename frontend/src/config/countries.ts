/** Common countries for customer master — India first (primary market) */
export const CUSTOMER_COUNTRIES = [
  'India',
  'Afghanistan',
  'Australia',
  'Bahrain',
  'Bangladesh',
  'Bhutan',
  'Canada',
  'China',
  'France',
  'Germany',
  'Indonesia',
  'Italy',
  'Japan',
  'Kenya',
  'Kuwait',
  'Malaysia',
  'Maldives',
  'Nepal',
  'Netherlands',
  'Oman',
  'Qatar',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'Sri Lanka',
  'Switzerland',
  'Thailand',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
] as const

export type CustomerCountry = (typeof CUSTOMER_COUNTRIES)[number]

export const DEFAULT_CUSTOMER_COUNTRY: CustomerCountry = 'India'
