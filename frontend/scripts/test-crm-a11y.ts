/**
 * CRM overlay / form accessibility static gate — npm run test:crm-a11y
 * Asserts shared CRM overlays expose dialog semantics (no new framework).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM A11y Static Gate\n')

const drawer = read('src/components/crm/CrmDrawerShell.tsx')
check('CrmDrawerShell role=dialog', drawer.includes('role="dialog"'))
check('CrmDrawerShell aria-modal', drawer.includes('aria-modal="true"'))
check('CrmDrawerShell Escape handler', /Escape/.test(drawer) && /onClose/.test(drawer))
check('CrmDrawerShell body scroll lock', drawer.includes("document.body.style.overflow = 'hidden'"))
check('CrmDrawerShell closeDisabled', drawer.includes('closeDisabled'))
check('CrmDrawerShell useId title', drawer.includes('useId()') && drawer.includes('aria-labelledby={titleId}'))

const deleteModal = read('src/components/crm/CrmDeleteConfirmModal.tsx')
check('CrmDeleteConfirmModal role=dialog', deleteModal.includes('role="dialog"'))
check('CrmDeleteConfirmModal aria-modal', deleteModal.includes('aria-modal="true"'))
check('CrmDeleteConfirmModal Escape', /Escape/.test(deleteModal))
check('CrmDeleteConfirmModal body lock', deleteModal.includes("document.body.style.overflow = 'hidden'"))

const saveView = read('src/components/design-system/SaveViewDialog.tsx')
check('SaveViewDialog role=dialog', saveView.includes('role="dialog"'))
check('SaveViewDialog aria-modal', saveView.includes('aria-modal="true"'))
check('SaveViewDialog Escape', /Escape/.test(saveView))
check('SaveViewDialog body lock', saveView.includes("document.body.style.overflow = 'hidden'"))

const confirm = read('src/components/ui/ConfirmDialog.tsx')
check('ConfirmDialog role=dialog', confirm.includes('role="dialog"'))
check('ConfirmDialog aria-modal', confirm.includes('aria-modal="true"'))
check('ConfirmDialog aria-labelledby', confirm.includes('aria-labelledby={titleId}'))

const validation = read('src/components/forms/validation/ValidationSummary.tsx')
check('ValidationSummary role=alert', validation.includes('role="alert"'))

const css = read('src/styles/dynamics-components.css')
const modalZ = /erp-modal-backdrop\s*\{[^}]*z-index:\s*(\d+)/s.exec(css)
const drawerZ = /crm-drawer-root\s*\{[^}]*z-index:\s*(\d+)/s.exec(css)
const confirmZ = /erp-confirm-backdrop\s*\{[^}]*z-index:\s*(\d+)/s.exec(css)
const modalZi = modalZ ? Number(modalZ[1]) : 0
const drawerZi = drawerZ ? Number(drawerZ[1]) : 0
const confirmZi = confirmZ ? Number(confirmZ[1]) : 0
check('Modal z-index above drawer', modalZi > drawerZi, `modal=${modalZi} drawer=${drawerZi}`)
check('Confirm z-index above modal', confirmZi > modalZi, `confirm=${confirmZi} modal=${modalZi}`)

console.log(`\nCRM a11y: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
