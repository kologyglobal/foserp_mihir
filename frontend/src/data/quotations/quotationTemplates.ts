import type { QuotationTemplate } from '../../types/crm'
import { ISO_TANK_26KL_SECTIONS, ISO_TANK_TEMPLATE_VERSION } from './templates/isoTank26Kl'
import { ISO_DRY_BULK_25CBM_SECTIONS, ISO_DRY_BULK_TEMPLATE_VERSION } from './templates/isoDryBulk25Cbm'
import { FLOUR_BULKER_42M3_SECTIONS, FLOUR_BULKER_42M3_TEMPLATE_VERSION } from './templates/flourBulker42M3'
import { TIPPER_30FE_M3_SECTIONS, TIPPER_30FE_M3_TEMPLATE_VERSION } from './templates/tipper30FeM3'
import { VF_WORD_PRINT_LAYOUT } from '../../utils/quotationEngine/printLayout'

/** Built-in quotation templates shipped with the app (demo + merge seed). */
export const DEFAULT_QUOTATION_TEMPLATES: QuotationTemplate[] = [
  {
    id: 'qtpl-iso-tank',
    templateName: '76 — 26 KL ISO Tank Container Quotation',
    productFamily: 'ISO Tank',
    version: ISO_TANK_TEMPLATE_VERSION,
    sections: ISO_TANK_26KL_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex works Chhapi, Banaskantha, North Gujarat. 30% advance with PO; balance against PI. Validity 60 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    createdById: 'system',
    createdByName: 'System',
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  },
  {
    id: 'qtpl-iso-dry-bulk-25cbm',
    templateName: '109 — 25 m³ ISO Tank Container Quotation',
    productFamily: 'ISO Dry Bulk',
    version: ISO_DRY_BULK_TEMPLATE_VERSION,
    sections: ISO_DRY_BULK_25CBM_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms: 'Ex works Chhapi, Banaskantha, North Gujarat. GST extra. Validity 20 days. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty: '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
    defaultExclusions: 'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    createdById: 'system',
    createdByName: 'System',
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  },
  {
    id: 'qtpl-flour-bulker-42m3',
    templateName: '152 — 42 m³ Hopper Type Flour Bulker Quotation',
    productFamily: 'Flour Bulker',
    version: FLOUR_BULKER_42M3_TEMPLATE_VERSION,
    sections: FLOUR_BULKER_42M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, and statutory charges excluded unless specified.',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    createdById: 'system',
    createdByName: 'System',
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  },
  {
    id: 'qtpl-tipper-30fe-m3',
    templateName: '146 — 30 m³ Tipper FE Type Quotation',
    productFamily: 'Tipper',
    version: TIPPER_30FE_M3_TEMPLATE_VERSION,
    sections: TIPPER_30FE_M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 40% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, pump/PTO, and statutory charges excluded unless specified.',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    createdById: 'system',
    createdByName: 'System',
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  },
]

/** Former built-ins removed from the catalog — drop on demo merge so they do not linger in localStorage. */
export const RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS = [
  'qtpl-standard-trailer',
  'qtpl-45m3-bulker',
  'qtpl-sidewall',
  'qtpl-job-work',
  'qtpl-spare-parts',
  'qtpl-flatbed',
  'qtpl-lowbed',
  'qtpl-tipper',
  'qtpl-custom',
] as const
