/** Re-export — canonical rows live under src (API ensure + seed share one source). */
export {
  QUOTATION_TEMPLATE_SEED_ROWS,
  VF_WORD_PRINT_LAYOUT_SEED,
  type QuotationTemplateSeedRow,
} from '../src/modules/crm/quotation-templates/quotation-template.catalog-seed.js'

export const QUOTATION_TEMPLATE_KEEP_CODES = [
  'ISO-TANK-26KL',
  'ISO-DRY-BULK-25CBM',
] as const
