/** Canonical seed for the VF Word quotation templates (76 + 109 + 152 + 146 + 154 + 156 + 164 + 165 + 175 + 178 + 183 + 184). */

import {
  ISO_TANK_26KL_SEED_SECTIONS,
  ISO_TANK_26KL_SEED_VERSION,
} from './quotation-template.iso-tank-26kl.js'
import {
  ISO_DRY_BULK_25CBM_SEED_SECTIONS,
  ISO_DRY_BULK_25CBM_SEED_VERSION,
} from './quotation-template.iso-dry-bulk-25cbm.js'
import {
  FLOUR_BULKER_42M3_SEED_SECTIONS,
  FLOUR_BULKER_42M3_SEED_VERSION,
} from './quotation-template.flour-bulker-42m3.js'
import {
  TIPPER_30FE_M3_SEED_SECTIONS,
  TIPPER_30FE_M3_SEED_VERSION,
} from './quotation-template.tipper-30fe-m3.js'
import {
  BULKER_TRAILER_45M3_SEED_SECTIONS,
  BULKER_TRAILER_45M3_SEED_VERSION,
} from './quotation-template.bulker-trailer-45m3.js'
import {
  SIDEWALL_34FT_5FT_SEED_SECTIONS,
  SIDEWALL_34FT_5FT_SEED_VERSION,
} from './quotation-template.sidewall-34ft-5ft.js'
import {
  CHEM_TANKER_30_5KL_SEED_SECTIONS,
  CHEM_TANKER_30_5KL_SEED_VERSION,
} from './quotation-template.chem-tanker-30-5kl.js'
import {
  WALKING_FLOOR_40FT_SEED_SECTIONS,
  WALKING_FLOOR_40FT_SEED_VERSION,
} from './quotation-template.walking-floor-40ft.js'
import {
  BULKER_23M3_SEED_SECTIONS,
  BULKER_23M3_SEED_VERSION,
} from './quotation-template.bulker-23m3.js'
import {
  CHEM_TANKER_16KL_SEED_SECTIONS,
  CHEM_TANKER_16KL_SEED_VERSION,
} from './quotation-template.chem-tanker-16kl.js'
import {
  TIPPING_TANK_31M3_SEED_SECTIONS,
  TIPPING_TANK_31M3_SEED_VERSION,
} from './quotation-template.tipping-tank-31m3.js'
import {
  TIP_TRAILER_34M3_SEED_SECTIONS,
  TIP_TRAILER_34M3_SEED_VERSION,
} from './quotation-template.tip-trailer-34m3.js'

export interface QuotationTemplateSeedRow {
  code: string
  templateName: string
  productFamily: string
  version: number
  defaultTerms: string
  defaultWarranty: string
  defaultExclusions: string
  sections: Array<Record<string, unknown>>
}

export const QUOTATION_TEMPLATE_SEED_ROWS: QuotationTemplateSeedRow[] = [
  {
    code: 'ISO-TANK-26KL',
    templateName: '76 — 26 KL ISO Tank Container Quotation',
    productFamily: 'ISO Tank',
    version: ISO_TANK_26KL_SEED_VERSION,
    defaultTerms:
      'Ex works Chhapi, Banaskantha, North Gujarat. 30% advance with PO; balance against PI. Validity 60 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    sections: ISO_TANK_26KL_SEED_SECTIONS,
  },
  {
    code: 'ISO-DRY-BULK-25CBM',
    templateName: '109 — 25 m³ ISO Tank Container Quotation',
    productFamily: 'ISO Dry Bulk',
    version: ISO_DRY_BULK_25CBM_SEED_VERSION,
    defaultTerms:
      'Ex works Chhapi, Banaskantha, North Gujarat. GST extra. Validity 20 days. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty.',
    defaultExclusions:
      'Freight, insurance, site unloading, and statutory registrations excluded unless specified.',
    // Full Word/PDF-mapped sections (dynamic {{placeholders}} + spec tables).
    sections: ISO_DRY_BULK_25CBM_SEED_SECTIONS,
  },
  {
    code: 'FLOUR-BULKER-42M3',
    templateName: '152 — 42 m³ Hopper Type Flour Bulker Quotation',
    productFamily: 'Flour Bulker',
    version: FLOUR_BULKER_42M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, and statutory charges excluded unless specified.',
    sections: FLOUR_BULKER_42M3_SEED_SECTIONS,
  },
  {
    code: 'TIPPER-30FE-M3',
    templateName: '146 — 30 m³ Tipper FE Type Quotation',
    productFamily: 'Tipper',
    version: TIPPER_30FE_M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 40% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, pump/PTO, and statutory charges excluded unless specified.',
    sections: TIPPER_30FE_M3_SEED_SECTIONS,
  },
  {
    code: 'BULKER-TRAILER-45M3',
    templateName: '154 — 45 m³ Bulker Trailer Quotation',
    productFamily: 'Bulker Trailer',
    version: BULKER_TRAILER_45M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Quoted without tyres.',
    sections: BULKER_TRAILER_45M3_SEED_SECTIONS,
  },
  {
    code: 'SIDEWALL-34FT-5FT',
    templateName: '156 — 34′ × 5′ Side Wall Trailer Quotation',
    productFamily: 'Side Wall Trailer',
    version: SIDEWALL_34FT_5FT_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, tyres, rims, and statutory charges excluded unless specified. Quoted without tyres and rims.',
    sections: SIDEWALL_34FT_5FT_SEED_SECTIONS,
  },
  {
    code: 'CHEM-TANKER-30-5KL',
    templateName: '164 — 30.5 KL Chemical Tanker Trailer Quotation',
    productFamily: 'Chemical Tanker',
    version: CHEM_TANKER_30_5KL_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, tyres, and statutory charges excluded unless specified. Quoted without tyres. Extra connections/flanges chargeable.',
    sections: CHEM_TANKER_30_5KL_SEED_SECTIONS,
  },
  {
    code: 'WALKING-FLOOR-40FT',
    templateName: '165 — 40 ft Walking Floor Quotation',
    productFamily: 'Walking Floor',
    version: WALKING_FLOOR_40FT_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 35% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, and statutory charges excluded unless specified. Walking floor supply and installation not in VFPL scope.',
    sections: WALKING_FLOOR_40FT_SEED_SECTIONS,
  },
  {
    code: 'BULKER-23M3',
    templateName: '175 — 23 m³ Bulker Quotation',
    productFamily: 'Bulker',
    version: BULKER_23M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified.',
    sections: BULKER_23M3_SEED_SECTIONS,
  },
  {
    code: 'CHEM-TANKER-16KL',
    templateName: '178 — 16 KL Chemical Tanker Quotation',
    productFamily: 'Chemical Tanker',
    version: CHEM_TANKER_16KL_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against delivery. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
    sections: CHEM_TANKER_16KL_SEED_SECTIONS,
  },
  {
    code: 'TIPPING-TANK-31M3',
    templateName: '183 — 31 m³ Tipping Tank Quotation',
    productFamily: 'Tipping Tank',
    version: TIPPING_TANK_31M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 30% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
    sections: TIPPING_TANK_31M3_SEED_SECTIONS,
  },
  {
    code: 'TIP-TRAILER-34M3',
    templateName: '184 — 34 m³ Tip Trailer Quotation',
    productFamily: 'Tip Trailer',
    version: TIP_TRAILER_34M3_SEED_VERSION,
    defaultTerms:
      'Ex-works Chhapi, Banaskantha, North Gujarat. GST @ 18% extra. Validity 20 days. 40% advance with PO; balance against PI. Advance non-refundable on cancellation. Subject to Chhapi jurisdiction.',
    defaultWarranty:
      '12 months against defective material and workmanship. Bought-out items carry OEM warranty. No warranty on hydraulic equipment and parts.',
    defaultExclusions:
      'Freight, insurance, RTO/registration, cabin supports, U-bolts, chassis extras, male coupler, and statutory charges excluded unless specified. Extra connections/flanges chargeable.',
    sections: TIP_TRAILER_34M3_SEED_SECTIONS,
  },
]

export const VF_WORD_PRINT_LAYOUT_SEED = {
  pageSize: 'A4',
  marginMm: 14,
  fontScale: 1,
  headerStyle: 'standard',
  showLogo: true,
  showCompanyHeader: true,
  showCustomerBlock: false,
  showPageFooter: true,
  showSignatureBlock: true,
  pageBreakBefore: ['price_table'],
  printSkin: 'vf_word',
} as const
