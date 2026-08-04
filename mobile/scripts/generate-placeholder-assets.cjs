/**
 * Minimal 1x1 PNG (blue #2563EB) used as Expo icon/splash placeholders.
 * Replace with brand assets before store release.
 */
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

// 1x1 PNG blue pixel base64
const PNG_1X1_BLUE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const dir = join(__dirname, '..', 'assets')
mkdirSync(dir, { recursive: true })
for (const name of ['icon.png', 'splash-icon.png', 'adaptive-icon.png', 'favicon.png']) {
  writeFileSync(join(dir, name), PNG_1X1_BLUE)
}
console.log('Wrote placeholder assets to', dir)
