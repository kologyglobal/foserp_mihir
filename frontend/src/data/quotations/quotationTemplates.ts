import type { QuotationTemplate } from '../../types/crm'
import { ISO_TANK_26KL_SECTIONS, ISO_TANK_TEMPLATE_VERSION } from './templates/isoTank26Kl'
import { ISO_DRY_BULK_25CBM_SECTIONS, ISO_DRY_BULK_TEMPLATE_VERSION } from './templates/isoDryBulk25Cbm'
import { FLOUR_BULKER_42M3_SECTIONS, FLOUR_BULKER_42M3_TEMPLATE_VERSION } from './templates/flourBulker42M3'
import { TIPPER_30FE_M3_SECTIONS, TIPPER_30FE_M3_TEMPLATE_VERSION } from './templates/tipper30FeM3'
import {
  BULKER_TRAILER_45M3_SECTIONS,
  BULKER_TRAILER_45M3_TEMPLATE_VERSION,
} from './templates/bulkerTrailer45M3'
import {
  SIDEWALL_34FT_5FT_SECTIONS,
  SIDEWALL_34FT_5FT_TEMPLATE_VERSION,
} from './templates/sidewall34Ft5Ft'
import {
  CHEM_TANKER_30_5KL_SECTIONS,
  CHEM_TANKER_30_5KL_TEMPLATE_VERSION,
} from './templates/chemTanker30_5Kl'
import {
  WALKING_FLOOR_40FT_SECTIONS,
  WALKING_FLOOR_40FT_TEMPLATE_VERSION,
} from './templates/walkingFloor40Ft'
import {
  BULKER_23M3_SECTIONS,
  BULKER_23M3_TEMPLATE_VERSION,
} from './templates/bulker23M3'
import {
  CHEM_TANKER_16KL_SECTIONS,
  CHEM_TANKER_16KL_TEMPLATE_VERSION,
} from './templates/chemTanker16Kl'
import {
  TIPPING_TANK_31M3_SECTIONS,
  TIPPING_TANK_31M3_TEMPLATE_VERSION,
} from './templates/tippingTank31M3'
import {
  TIP_TRAILER_34M3_SECTIONS,
  TIP_TRAILER_34M3_TEMPLATE_VERSION,
} from './templates/tipTrailer34M3'
import { VF_WORD_PRINT_LAYOUT, KOLOGY_PROPOSAL_PRINT_LAYOUT } from '../../utils/quotationEngine/printLayout'
import {
  KOLOGY_OUTBOUND_PILOT_SECTIONS,
  KOLOGY_OUTBOUND_PILOT_TEMPLATE_VERSION,
} from './templates/kologyOutboundPilot'

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
  {
    id: 'qtpl-bulker-trailer-45m3',
    templateName: '154 — 45 m³ Bulker Trailer Quotation',
    productFamily: 'Bulker Trailer',
    version: BULKER_TRAILER_45M3_TEMPLATE_VERSION,
    sections: BULKER_TRAILER_45M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Quoted without tyres.',
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
    id: 'qtpl-sidewall-34ft-5ft',
    templateName: '156 — 34′ × 5′ Side Wall Trailer Quotation',
    productFamily: 'Side Wall Trailer',
    version: SIDEWALL_34FT_5FT_TEMPLATE_VERSION,
    sections: SIDEWALL_34FT_5FT_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, tyres, rims, and statutory charges excluded unless specified. Quoted without tyres and rims.',
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
    id: 'qtpl-chem-tanker-30-5kl',
    templateName: '164 — 30.5 KL Chemical Tanker Trailer Quotation',
    productFamily: 'Chemical Tanker',
    version: CHEM_TANKER_30_5KL_TEMPLATE_VERSION,
    sections: CHEM_TANKER_30_5KL_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, tyres, and statutory charges excluded unless specified. Quoted without tyres. Extra connections/flanges chargeable.',
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
    id: 'qtpl-walking-floor-40ft',
    templateName: '165 — 40 ft Walking Floor Quotation',
    productFamily: 'Walking Floor',
    version: WALKING_FLOOR_40FT_TEMPLATE_VERSION,
    sections: WALKING_FLOOR_40FT_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 35% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, and statutory charges excluded unless specified. Walking floor supply and installation not in VFPL scope.',
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
    id: 'qtpl-bulker-23m3',
    templateName: '175 — 23 m³ Bulker Quotation',
    productFamily: 'Bulker',
    version: BULKER_23M3_TEMPLATE_VERSION,
    sections: BULKER_23M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified.',
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
    id: 'qtpl-chem-tanker-16kl',
    templateName: '178 — 16 KL Chemical Tanker Quotation',
    productFamily: 'Chemical Tanker',
    version: CHEM_TANKER_16KL_TEMPLATE_VERSION,
    sections: CHEM_TANKER_16KL_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
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
    id: 'qtpl-tipping-tank-31m3',
    templateName: '183 — 31 m³ Tipping Tank Quotation',
    productFamily: 'Tipping Tank',
    version: TIPPING_TANK_31M3_TEMPLATE_VERSION,
    sections: TIPPING_TANK_31M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
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
    id: 'qtpl-tip-trailer-34m3',
    templateName: '184 — 34 m³ Tip Trailer Quotation',
    productFamily: 'Tip Trailer',
    version: TIP_TRAILER_34M3_TEMPLATE_VERSION,
    sections: TIP_TRAILER_34M3_SECTIONS,
    printLayout: { ...VF_WORD_PRINT_LAYOUT },
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 40% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
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

/** SERVICES packaging (Kology) — outbound pilot proposal is the standard printable template. */
export const SERVICES_DEFAULT_QUOTATION_TEMPLATES: QuotationTemplate[] = [
  {
    id: 'qtpl-kology-outbound-pilot',
    code: 'KOLOGY-OUTBOUND-PILOT',
    templateName: 'Kology — Outbound Pilot Proposal',
    productFamily: 'Outbound Services',
    version: KOLOGY_OUTBOUND_PILOT_TEMPLATE_VERSION,
    sections: KOLOGY_OUTBOUND_PILOT_SECTIONS,
    printLayout: { ...KOLOGY_PROPOSAL_PRINT_LAYOUT },
    defaultTerms:
      'Pilot fees billed monthly in advance. GST extra. Validity 30 days from quotation date.',
    defaultWarranty: '',
    defaultExclusions: 'Tooling / dialer / LinkedIn Sales Navigator billed at actuals unless included.',
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
