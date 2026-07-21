import { z } from 'zod'
import { phoneDigitsField, refineMobileWithCountryField } from '../../phoneValidationZod'
import { optionalEmailField } from '../emailZod'
import { gstNumber, requiredText, nonNegativeNumber } from '../crmFields'

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const companyFormSchema = z
  .object({
    customerCode: requiredText('Customer code is required'),
    customerName: requiredText('Customer name is required'),
    customerType: z.enum(['corporate', 'dealer', 'government']),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    shippingAddress: z.string().optional(),
    shippingAddressLine2: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingPincode: z.string().optional(),
    shippingCountry: z.string().optional(),
    shippingSameAsBilling: z.boolean().optional(),
    city: requiredText('City required'),
    state: requiredText('State required'),
    pincode: z.string(),
    country: requiredText('Country required'),
    gstin: gstNumber(),
    pan: z.string().max(10).optional(),
    contactPerson: z.string(),
    contactPhone: phoneDigitsField,
    contactEmail: optionalEmailField,
    creditDays: nonNegativeNumber(),
    creditLimit: nonNegativeNumber(),
    salesTerritory: z.enum(['West', 'North', 'South', 'East']),
    isActive: z.boolean(),
  })
  .superRefine(refineMobileWithCountryField('contactPhone', 'country'))

export type CompanyFormData = z.infer<typeof companyFormSchema>

/** Alias matching prior inline schema name in CustomerPages. */
export const companySchema = companyFormSchema
