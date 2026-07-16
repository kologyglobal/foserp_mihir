/** Standard form section titles — every data entry screen uses these */
export const FORM_SECTIONS = [
  'Basic Information',
  'Commercial Information',
  'Configuration',
  'Remarks',
  'Attachments',
  'Audit Information',
] as const

export type FormSectionId = (typeof FORM_SECTIONS)[number]

export const FORM_FOOTER_ACTIONS = [
  'cancel',
  'saveDraft',
  'save',
  'saveAndNew',
  'saveAndClose',
] as const

export type FormFooterActionId = (typeof FORM_FOOTER_ACTIONS)[number]

/** Quotation / document builder footers */
export const DOCUMENT_FOOTER_ACTIONS = [
  'cancel',
  'saveDraft',
  'save',
  'preview',
  'submitApproval',
  'generatePdf',
  'saveAndClose',
] as const

export type DocumentFooterActionId = (typeof DOCUMENT_FOOTER_ACTIONS)[number]

export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const
export type ButtonSize = (typeof BUTTON_SIZES)[number]

export const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
  'success',
] as const
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

/** Lucide — single icon library for the ERP */
export const ICON_LIBRARY = 'lucide-react' as const
