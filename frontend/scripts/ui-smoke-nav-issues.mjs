import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', '_ui_smoke_shortage_out')
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  const shot = async (n) => page.screenshot({ path: join(OUT, `${n}.png`), fullPage: true })

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.locator('#tenantSlug').fill('vasant-trailers')
  await page.locator('#email').fill('admin@vasant-trailers.com')
  await page.locator('#password').fill('Admin@123')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
  await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {})
  await page.getByText(/CRM Command Center/i).first().waitFor({ timeout: 60000 })
  await shot('nav-01-crm')
  console.log('login_ok', page.url())

  // Client-side navigate via history API + React Router may need click.
  // Prefer clicking Inventory in sidebar.
  const invLink = page.locator('a[href="/inventory"], a[href^="/inventory/"]').first()
  if (await invLink.count()) {
    await invLink.click()
  } else {
    await page.locator('nav a, aside a').filter({ hasText: /Inventory/i }).first().click().catch(() => {})
  }
  await page.waitForTimeout(2500)
  await shot('nav-02-inventory')
  console.log('after_inventory_click', page.url())

  // Deep-link using SPA soft navigation: click Issue Stock if present, else set location via RR.
  const issueLink = page.locator('a[href="/inventory/movements/issues"]').first()
  if (await issueLink.count()) {
    await issueLink.click()
  } else {
    // Soft navigate without full document reload by using window.history + click on same-origin link
    await page.evaluate(() => {
      const a = document.createElement('a')
      a.href = '/inventory/movements/issues?tab=assign'
      a.textContent = 'go'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
    })
  }
  await page.waitForTimeout(3500)
  console.log('after_issues', page.url())
  if (page.url().includes('/login')) {
    await shot('nav-03-login-redirect')
    console.log(JSON.stringify({ ok: false, reason: 'redirected_to_login', errs }))
    await browser.close()
    return
  }

  // Ensure assign tab
  const assignTab = page.getByRole('button', { name: /Assign to production/i })
  if (await assignTab.count()) await assignTab.click()
  await page.waitForTimeout(2000)
  await shot('nav-03-issues')

  const search = page.getByPlaceholder(/search/i).first()
  if (await search.count()) {
    await search.fill('WO-000045')
    await page.waitForTimeout(1500)
  }
  await shot('nav-04-filtered')
  const body = await page.locator('body').innerText()
  const hasWo = /WO-000045|BO-FASTENERS|Assign to production|Issue Stock/i.test(body)
  console.log(
    JSON.stringify(
      {
        ok: hasWo,
        url: page.url(),
        hasWo045: body.includes('WO-000045'),
        hasFasteners: body.includes('BO-FASTENERS'),
        hasIssueStock: /Issue Stock/i.test(body),
        snippet: body.slice(0, 500),
        errs: errs.slice(0, 10),
      },
      null,
      2,
    ),
  )

  // Create PR if row visible
  const row = page.locator('tbody tr').filter({ hasText: /WO-000045|BO-FASTENERS/ }).first()
  if (await row.count()) {
    const cb = row.locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check({ force: true })
    const btn = page.getByRole('button', { name: /Create (shortage )?PR|Shortage PR|Create PR/i }).first()
    if (await btn.count()) {
      await btn.click()
      await page.waitForTimeout(500)
      const confirm = page.getByRole('button', { name: /Create PR|Create 1 PR|Confirm/i })
      if (await confirm.count()) await confirm.last().click()
      await page.waitForTimeout(2500)
      await shot('nav-05-after-pr')
      console.log('create_pr_clicked', (await page.locator('body').innerText()).match(/PR[-/A-Z0-9]+/i)?.[0])
    } else {
      console.log('create_pr_button_missing')
    }
  } else {
    console.log('no_assign_row')
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
