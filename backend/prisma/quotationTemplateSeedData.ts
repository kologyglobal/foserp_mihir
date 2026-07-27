/** Re-export — canonical rows live under src (API ensure + seed share one source). */
export {
  QUOTATION_TEMPLATE_SEED_ROWS,
  VF_WORD_PRINT_LAYOUT_SEED,
  type QuotationTemplateSeedRow,
} from '../src/modules/crm/quotation-templates/quotation-template.catalog-seed.js'

export const QUOTATION_TEMPLATE_KEEP_CODES = [
  'ISO-TANK-26KL',
  'ISO-DRY-BULK-25CBM',
  'FLOUR-BULKER-42M3',
  'TIPPER-30FE-M3',
  'BULKER-TRAILER-45M3',
  'SIDEWALL-34FT-5FT',
  'CHEM-TANKER-30-5KL',
  'WALKING-FLOOR-40FT',
  'BULKER-23M3',
  'CHEM-TANKER-16KL',
  'TIPPING-TANK-31M3',
  'TIP-TRAILER-34M3',
] as const
