/** Shared Enterprise Workspace class names — align with lead module (CrmLeadFormPage / Lead360Workspace). */
export const ENTERPRISE_WORKSPACE_BASE = 'enterprise-workspace'

/** Create / edit document forms (34px Fiori fields, section nav, sticky save bar). */
export const ENTERPRISE_FORM_CLASS = 'enterprise-workspace--dynamics-form'

/** Read-only 360 / detail views. */
export const ENTERPRISE_DETAIL_CLASS = 'enterprise-workspace--dynamics-detail'

/** Combined form + detail (360 pages that reuse form chrome). */
export const ENTERPRISE_FORM_DETAIL_CLASS = `${ENTERPRISE_FORM_CLASS} ${ENTERPRISE_DETAIL_CLASS}`

export const enterpriseFormClassName = (...extra: (string | false | undefined)[]) =>
  [ENTERPRISE_WORKSPACE_BASE, ENTERPRISE_FORM_CLASS, ...extra].filter(Boolean).join(' ')

export const enterpriseDetailClassName = (...extra: (string | false | undefined)[]) =>
  [ENTERPRISE_WORKSPACE_BASE, ENTERPRISE_DETAIL_CLASS, ...extra].filter(Boolean).join(' ')

export const enterpriseFormDetailClassName = (...extra: (string | false | undefined)[]) =>
  [ENTERPRISE_WORKSPACE_BASE, ENTERPRISE_FORM_DETAIL_CLASS, ...extra].filter(Boolean).join(' ')
