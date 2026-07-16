/**
 * Design system validation — npm run test:design-system
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DS = path.join(ROOT, 'src/design-system')

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

function listFiles(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else out.push(full)
  }
  return out
}

console.log('\nDesign System Validation\n')

const requiredTheme = ['colors.ts', 'spacing.ts', 'typography.ts', 'radius.ts', 'shadows.ts', 'zIndex.ts', 'breakpoints.ts', 'index.ts']
for (const f of requiredTheme) {
  check(`theme/${f}`, existsSync(path.join(DS, 'theme', f)))
}

const requiredComponents = [
  'Button.tsx', 'Card.tsx', 'DataTable.tsx', 'Input.tsx', 'Select.tsx', 'StatusBadge.tsx',
  'EmptyState.tsx', 'LoadingState.tsx', 'FormLayout.tsx', 'Modal.tsx', 'HelpPanel.tsx',
  'FooterActions.tsx', 'DocumentFooterActions.tsx', 'SectionHeader.tsx', 'KPI.tsx', 'FilterBar.tsx',
]
for (const f of requiredComponents) {
  check(`components/${f}`, existsSync(path.join(DS, 'components', f)))
}

check('ThemeProvider', existsSync(path.join(DS, 'ThemeProvider.tsx')))
check('Barrel index.ts', existsSync(path.join(DS, 'index.ts')))
check('styles.css', existsSync(path.join(DS, 'styles.css')))

const index = readFileSync(path.join(DS, 'index.ts'), 'utf8')
check('Exports ThemeProvider', index.includes('ThemeProvider'))
check('Exports designTheme', index.includes('designTheme'))
check('Exports components', index.includes('./components'))

const colors = readFileSync(path.join(DS, 'theme/colors.ts'), 'utf8')
check('Colors use CSS vars only', !colors.match(/#[0-9a-fA-F]{3,8}/))

const typography = readFileSync(path.join(DS, 'theme/typography.ts'), 'utf8')
check('Typography uses Segoe UI', typography.includes('Segoe UI'))

const main = readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8')
check('App wrapped in ThemeProvider', main.includes('<ThemeProvider>'))

const indexCss = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')
check('Design system CSS imported', indexCss.includes('design-system/styles.css'))

const dsFiles = listFiles(DS).length
check('Design system file count', dsFiles >= 35, `${dsFiles} files`)

console.log(`\nDesign system: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
