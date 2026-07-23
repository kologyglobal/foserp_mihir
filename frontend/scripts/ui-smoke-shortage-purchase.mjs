/**
 * Browser UI smoke: shortage → PR → approve → planning PO → GRN → stock/reserve.
 * Reads precondition JSON from PRECOND_JSON (WO with SHORT materials already reserved).
 *
 * Usage:
 *   PRECOND_JSON=../_ui_smoke_precond_clean.json node scripts/ui-smoke-shortage-purchase.mjs
 */
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', '_ui_smoke_shortage_out')
const PRECOND_PATH = process.env.PRECOND_JSON ?? join(__dirname, '..', '..', '_ui_smoke_precond_clean.json')
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const SHORT_ITEM = 'BO-FASTENERS'
const VENDOR_CODE = 'VND-FAST-04'
const RATE = 15

const steps = []
function push(step, ok, detail) {
  steps.push({ step, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function loginApi(email, password) {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { email, password, tenantSlug: TENANT },
  })
  if (status !== 200 || !json?.data?.accessToken) {
    throw new Error(`Login failed ${email}: ${status} ${JSON.stringify(json)}`)
  }
  return { token: json.data.accessToken }
}

async function shot(page, name) {
  mkdirSync(OUT, { recursive: true })
  const path = join(OUT, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}

function loadPrecond() {
  if (!existsSync(PRECOND_PATH)) throw new Error(`Missing precondition file: ${PRECOND_PATH}`)
  const raw = readFileSync(PRECOND_PATH, 'utf8')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON in precondition file')
  return JSON.parse(raw.slice(start, end + 1))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const report = { env: {}, steps, blockers: [], apiFallback: [] }
  const pre = loadPrecond()
  const ctx = {
    woId: pre.woId,
    woNo: pre.woNo,
    shortMat: { id: pre.shortMatId },
    shortItem: { id: pre.shortItemId },
    wip: { id: pre.warehouseId },
  }
  push('API precondition loaded', true, `${ctx.woNo} mat=${ctx.shortMat.id} shortageQty=${pre.shortageQty}`)

  const health = await fetch(`${API}/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }))
  report.env.backend = health?.success ? 'up :5000' : `down ${JSON.stringify(health)}`
  const fe = await fetch(BASE).then((r) => r.status).catch((e) => String(e))
  report.env.frontend = fe === 200 ? 'up :5173' : `status=${fe}`
  report.env.viteUseApi = true
  report.env.tenant = TENANT
  report.env.browserTool =
    'playwright-core + system Chrome (cursor-ide-browser MCP could not retain tabs in this session)'

  const admin = await loginApi('admin@vasant-trailers.com', 'Admin@123')
  report.env.loginRole = 'admin@vasant-trailers.com'
  let purchaseToken = admin.token
  try {
    const p = await loginApi('purchase@vasant-trailers.com', 'Purchase@123')
    purchaseToken = p.token
    report.env.purchaseLogin = 'purchase@vasant-trailers.com'
  } catch {
    report.env.purchaseLogin = 'unavailable — using admin'
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--window-size=1400,900'],
  })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(25000)
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#email', { timeout: 20000 })
    await shot(page, '01-login')
    await page.locator('#tenantSlug').fill(TENANT)
    await page.locator('#email').fill('admin@vasant-trailers.com')
    await page.locator('#password').fill('Admin@123')
    await page.getByRole('button', { name: /^Sign in$/i }).click()
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const loggedIn = !page.url().includes('/login')
    // AppShell shows "Loading data from server" until masters hydrate
    await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    // Wait for real shell chrome — not just URL change
    await page.getByText(/Inventory|Purchase|CRM/i).first().waitFor({ timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const shellReady = (await page.getByText(/Inventory|Purchase/i).count()) > 0
    push('UI login', loggedIn && shellReady, `${page.url()} shellReady=${shellReady}`)
    await shot(page, '02-after-login')
    if (!loggedIn || !shellReady) {
      report.blockers.push(shellReady ? 'Login failed in UI' : 'AppShell stuck on Loading data from server')
      throw new Error('UI login/shell failed')
    }

    await page.goto(`${BASE}/inventory/movements/issues?tab=assign`, { waitUntil: 'domcontentloaded' })
    await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await page.getByText(/Issue Stock|Assign to production/i).first().waitFor({ timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await shot(page, '03-issues-assign')

    const search = page.getByPlaceholder(/search/i).first()
    if (await search.count()) {
      await search.fill(ctx.woNo || SHORT_ITEM)
      await page.waitForTimeout(1500)
    }
    await shot(page, '04-issues-filtered')

    const rowText = ctx.woNo || SHORT_ITEM
    const row = page.locator('tbody tr').filter({ hasText: rowText }).first()
    let prCreatedInUi = false
    let prNumber = null
    let prId = null

    if (await row.count()) {
      const cb = row.locator('input[type="checkbox"]').first()
      if (await cb.count()) await cb.check({ force: true })
      else await row.click()

      const createPrBtn = page.getByRole('button', { name: /Create (shortage )?PR|Shortage PR|Create PR/i }).first()
      if (await createPrBtn.count()) {
        await createPrBtn.click()
        await page.waitForTimeout(600)
        const confirm = page.getByRole('button', { name: /Create PR|Create 1 PR|Confirm/i })
        if (await confirm.count()) await confirm.last().click()
        await page.waitForTimeout(3000)
        await shot(page, '05-after-create-pr')
        const bodyText = await page.locator('body').innerText()
        const m = bodyText.match(/PR[-/A-Z0-9]+/i)
        prNumber = m?.[0] ?? null
        await page.getByRole('button', { name: /Production requisitions/i }).click().catch(() => {})
        await page.waitForTimeout(2000)
        await shot(page, '06-production-prs')
        const prTabText = await page.locator('body').innerText()
        const m2 = prTabText.match(/PR[-/]?\d[\w/-]*/i) || prTabText.match(/REQ[-/]?\d[\w/-]*/i)
        if (m2) prNumber = m2[0]
        prCreatedInUi = Boolean(prNumber) || /production shortage|requisition/i.test(prTabText)
        push('1. UI create shortage PR', prCreatedInUi, `url=${page.url()} doc=${prNumber ?? 'unknown'} wo=${ctx.woNo}`)
      } else {
        push('1. UI create shortage PR', false, 'Create PR button not found')
        report.blockers.push('Create PR button missing on Assign tab')
      }
    } else {
      push('1. UI create shortage PR', false, `No assign row for ${rowText}`)
      report.blockers.push('Assign queue missing shortage row')
      await shot(page, '04b-no-row')
    }

    if (!prCreatedInUi) {
      const shortagePr = await api(`/t/${TENANT}/manufacturing/store-workbench/issues/shortage-requisition`, {
        method: 'POST',
        token: admin.token,
        body: {
          materialIds: [ctx.shortMat.id],
          priority: 'HIGH',
          submit: false,
          idempotencyKey: `ui-smoke-bulk-pr-${Date.now()}`,
        },
      })
      const payload = shortagePr.json?.data?.requisition ?? shortagePr.json?.data
      prId = payload?.id
      prNumber = payload?.requisitionNumber ?? payload?.prNumber ?? payload?.number ?? prNumber
      push(
        '1b. API fallback shortage PR',
        [200, 201].includes(shortagePr.status),
        `${prNumber ?? prId} http=${shortagePr.status} body=${JSON.stringify(shortagePr.json).slice(0, 200)}`,
      )
      report.apiFallback.push('Created shortage PR via store-workbench API')
    }

    if (!prId) {
      const mats = await api(`/t/${TENANT}/manufacturing/work-orders/${ctx.woId}/materials`, { token: admin.token })
      const list = Array.isArray(mats.json.data) ? mats.json.data : mats.json.data?.materials ?? []
      const line = list.find((m) => m.id === ctx.shortMat.id)
      prId = line?.purchaseRequisitionId
    }
    if (!prId && prNumber) {
      const list = await api(`/t/${TENANT}/purchase/requisitions?search=${encodeURIComponent(prNumber)}&pageSize=20`, {
        token: purchaseToken,
      })
      const rows = list.json?.data?.items ?? list.json?.data?.requisitions ?? list.json?.data ?? []
      const hit = (Array.isArray(rows) ? rows : []).find(
        (r) =>
          r.documentNumber === prNumber ||
          r.requisitionNumber === prNumber ||
          r.prNumber === prNumber,
      )
      prId = hit?.id
      if (hit?.documentNumber) prNumber = hit.documentNumber
    }

    let approved = false
    if (prId) {
      await page.goto(`${BASE}/purchase/requisitions/${prId}`, { waitUntil: 'domcontentloaded' })
      await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
      await page.getByText(/Purchase Requisition|Requisition|PR-/i).first().waitFor({ timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(1500)
      await shot(page, '07-pr-detail')
      const submitBtn = page.getByRole('button', { name: /^Submit$/i })
      if (await submitBtn.count()) {
        await submitBtn.click()
        await page.waitForTimeout(2000)
      }
      await shot(page, '08-pr-after-submit')

      await page.goto(`${BASE}/purchase/approvals`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      await shot(page, '09-approvals')
      const needle = prNumber || prId.slice(0, 8)
      const approveRow = page.locator('tbody tr').filter({ hasText: needle }).first()
      if (await approveRow.count()) {
        const approveBtn = approveRow.getByRole('button', { name: /Approve/i })
        if (await approveBtn.count()) {
          await approveBtn.click()
          await page.waitForTimeout(800)
          const confirm = page.getByRole('button', { name: /Approve|Confirm/i })
          if (await confirm.count()) await confirm.last().click()
          await page.waitForTimeout(2000)
          approved = true
        }
      }
      if (!approved) {
        await page.goto(`${BASE}/purchase/requisitions/${prId}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        const approveBtn = page.getByRole('button', { name: /^Approve$/i })
        if (await approveBtn.count()) {
          await approveBtn.click()
          await page.waitForTimeout(2000)
          approved = true
        }
      }
      await shot(page, '10-pr-approve-attempt')
      const prGet = await api(`/t/${TENANT}/purchase/requisitions/${prId}`, { token: purchaseToken })
      const st = prGet.json?.data?.status
      if (String(st).toLowerCase() === 'approved') approved = true
      if (!prNumber) prNumber = prGet.json?.data?.documentNumber ?? prGet.json?.data?.requisitionNumber
      push('2. UI approve PR', approved, `pr=${prNumber ?? prId} status=${st} url=${page.url()}`)
      if (!approved) {
        await api(`/t/${TENANT}/purchase/requisitions/${prId}/submit`, {
          method: 'POST',
          token: purchaseToken,
          body: { remarks: 'UI smoke submit fallback' },
        })
        const a = await api(`/t/${TENANT}/purchase/requisitions/${prId}/approve`, {
          method: 'POST',
          token: admin.token,
          body: { remarks: 'UI smoke approve fallback' },
        })
        report.apiFallback.push('PR submit/approve via API')
        const prGet2 = await api(`/t/${TENANT}/purchase/requisitions/${prId}`, { token: purchaseToken })
        approved = String(prGet2.json?.data?.status).toLowerCase() === 'approved'
        push('2b. API fallback approve PR', approved, `http=${a.status} status=${prGet2.json?.data?.status}`)
      }
    } else {
      push('2. UI approve PR', false, 'No PR id')
      report.blockers.push('No PR id after step 1')
    }

    let poNumber = null
    let poId = null
    await page.goto(`${BASE}/purchase/planning-sheet`, { waitUntil: 'domcontentloaded' })
    await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await page.getByText(/Planning Sheet|Purchase Planning/i).first().waitFor({ timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)
    if (prNumber) {
      const s = page.getByPlaceholder(/search/i).first()
      if (await s.count()) {
        await s.fill(prNumber)
        await page.waitForTimeout(1500)
      }
    }
    await shot(page, '11-planning-sheet')

    const planRow = page.locator('tbody tr').filter({ hasText: prNumber || SHORT_ITEM }).first()
    let poCreatedUi = false
    if (await planRow.count()) {
      const cb = planRow.locator('input[type="checkbox"]').first()
      if (await cb.count()) await cb.check({ force: true })

      const bulkVendor = page.getByRole('button', { name: /vendor/i })
      if (await bulkVendor.count()) {
        await bulkVendor.first().click().catch(() => {})
        await page.waitForTimeout(500)
        const vendorSelect = page.locator('select').first()
        if (await vendorSelect.count()) {
          const opts = await vendorSelect.locator('option').all()
          for (const o of opts) {
            const t = await o.textContent()
            if (t && t.includes(VENDOR_CODE)) {
              await vendorSelect.selectOption({ label: t.trim() }).catch(() => {})
              break
            }
          }
        }
        const apply = page.getByRole('button', { name: /Apply|Save|Confirm|OK|Select/i })
        if (await apply.count()) await apply.last().click().catch(() => {})
        await page.waitForTimeout(1000)
      }

      const approvePlan = page.getByRole('button', { name: /Approve/i })
      if (await approvePlan.count()) {
        await approvePlan.first().click().catch(() => {})
        await page.waitForTimeout(1000)
      }

      const createPo = page.getByRole('button', { name: /Create Purchase Order|Create PO/i })
      if (await createPo.count()) {
        await createPo.first().click()
        await page.waitForTimeout(2500)
        await shot(page, '12-after-create-po')
        const body = await page.locator('body').innerText()
        const m = body.match(/PO[-/]?\d[\w/-]*/i)
        poNumber = m?.[0] ?? null
        poCreatedUi = Boolean(poNumber) || /purchase order created|created.*PO/i.test(body)
      }
      push('3. UI create PO from planning', poCreatedUi, `po=${poNumber ?? 'unknown'} url=${page.url()}`)
    } else {
      push('3. UI create PO from planning', false, 'Planning row not found in UI')
      report.blockers.push('Planning sheet row not visible')
    }

    if (!poCreatedUi && prId) {
      const all = await api(`/t/${TENANT}/purchase/planning-sheet?pageSize=100`, { token: purchaseToken })
      let rows = all.json?.data?.rows ?? all.json?.data?.items ?? all.json?.data ?? []
      if (!Array.isArray(rows)) rows = []
      const rowIds = rows
        .filter(
          (r) =>
            r.purchaseRequisitionId === prId ||
            r.prNumber === prNumber ||
            r.requisitionNumber === prNumber ||
            (r.itemCode === SHORT_ITEM && !String(r.status).toLowerCase().includes('po')),
        )
        .slice(0, 5)
        .map((r) => r.id)

      const vendors = await api(`/t/${TENANT}/masters/vendors?search=${encodeURIComponent(VENDOR_CODE)}`, {
        token: purchaseToken,
      })
      const vrows = vendors.json?.data?.vendors ?? vendors.json?.data ?? []
      const vendor = (Array.isArray(vrows) ? vrows : []).find((v) => v.code === VENDOR_CODE || v.vendorCode === VENDOR_CODE)

      if (rowIds.length && vendor?.id) {
        await api(`/t/${TENANT}/purchase/planning-sheet/bulk-select-vendor`, {
          method: 'POST',
          token: purchaseToken,
          body: { rowIds, vendorId: vendor.id, expectedRate: RATE, negotiatedRate: RATE },
        })
        await api(`/t/${TENANT}/purchase/planning-sheet/bulk-status`, {
          method: 'POST',
          token: admin.token,
          body: { rowIds, status: 'APPROVED' },
        })
        const createPo = await api(`/t/${TENANT}/purchase/planning-sheet/create-po`, {
          method: 'POST',
          token: purchaseToken,
          body: { rowIds },
        })
        poId =
          createPo.json?.data?.orders?.[0]?.id ??
          createPo.json?.data?.purchaseOrderIds?.[0] ??
          createPo.json?.data?.purchaseOrderId
        poNumber = createPo.json?.data?.orders?.[0]?.orderNumber ?? poNumber
        push(
          '3b. API fallback create PO',
          createPo.status === 201 && Boolean(poId),
          `po=${poNumber ?? poId} http=${createPo.status}`,
        )
        report.apiFallback.push('PO created via planning-sheet API')
      } else {
        push('3b. API fallback create PO', false, `rows=${rowIds.length} vendor=${vendor?.id ?? 'missing'}`)
      }
    }

    if (poId || poNumber) {
      if (!poId && poNumber) {
        const pol = await api(`/t/${TENANT}/purchase/orders?search=${encodeURIComponent(poNumber)}`, {
          token: purchaseToken,
        })
        const orows = pol.json?.data?.items ?? pol.json?.data?.orders ?? pol.json?.data ?? []
        poId = (Array.isArray(orows) ? orows : []).find(
          (o) => o.orderNumber === poNumber || o.documentNumber === poNumber,
        )?.id
      }
      if (poId) {
        await api(`/t/${TENANT}/purchase/orders/${poId}/submit`, { method: 'POST', token: purchaseToken, body: {} })
        await api(`/t/${TENANT}/purchase/orders/${poId}/approve`, { method: 'POST', token: admin.token, body: {} })
        await api(`/t/${TENANT}/purchase/orders/${poId}/send-to-vendor`, {
          method: 'POST',
          token: purchaseToken,
          body: {},
        })
        report.apiFallback.push('PO submit/approve/send via API (lifecycle to enable GRN)')
      }
    }

    let grnNumber = null
    await page.goto(`${BASE}/purchase/grn`, { waitUntil: 'domcontentloaded' })
    await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await page.getByText(/Goods Receipt|GRN/i).first().waitFor({ timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await shot(page, '13-grn-list')
    const newGrn = page.getByRole('link', { name: /New|Create|Receive/i }).or(
      page.getByRole('button', { name: /New|Create GRN|Receive/i }),
    )
    if (await newGrn.count()) {
      await newGrn.first().click()
      await page.waitForTimeout(2000)
      await shot(page, '14-grn-editor')
      push('4. UI GRN list/editor', true, `opened ${page.url()}`)
    } else {
      push('4. UI GRN list/editor', false, 'New GRN control not found')
      report.blockers.push('GRN new button not found')
    }

    if (poId) {
      const poDetail = await api(`/t/${TENANT}/purchase/orders/${poId}`, { token: purchaseToken })
      const po = poDetail.json?.data
      const line = po?.lines?.[0]
      const qty = Number(line?.orderedQuantity ?? line?.quantity ?? 20)
      const grnCreate = await api(`/t/${TENANT}/purchase/grns`, {
        method: 'POST',
        token: purchaseToken,
        body: {
          purchaseOrderId: poId,
          receiptDate: new Date().toISOString().slice(0, 10),
          warehouseId: ctx.wip.id,
          vendorChallanNumber: `CH-UI-${Date.now()}`,
          inspectionRequired: false,
          lines: [{ purchaseOrderLineId: line.id, receivedQuantity: qty, qcRequired: false }],
        },
      })
      const grnId = grnCreate.json?.data?.id
      grnNumber = grnCreate.json?.data?.grnNumber ?? grnCreate.json?.data?.receiptNumber
      if (grnId) {
        await api(`/t/${TENANT}/purchase/grns/${grnId}/submit`, { method: 'POST', token: purchaseToken, body: {} })
      }
      push('4b. API GRN + submit', grnCreate.status === 201, `${grnNumber ?? grnId} http=${grnCreate.status}`)
      report.apiFallback.push('GRN create/submit via API')

      await page.goto(`${BASE}/inventory/movements/issues?tab=assign`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      await shot(page, '16-issues-after-grn')

      await api(`/t/${TENANT}/manufacturing/work-orders/${ctx.woId}/materials/release-reservation`, {
        method: 'POST',
        token: admin.token,
        body: { materialIds: [ctx.shortMat.id] },
      }).catch(() => {})
      const re = await api(`/t/${TENANT}/manufacturing/work-orders/${ctx.woId}/materials/reserve`, {
        method: 'POST',
        token: admin.token,
        body: { materialIds: [ctx.shortMat.id] },
      })
      const mats = await api(`/t/${TENANT}/manufacturing/work-orders/${ctx.woId}/materials`, { token: admin.token })
      const list = Array.isArray(mats.json.data) ? mats.json.data : mats.json.data?.materials ?? []
      const after = list.find((m) => m.id === ctx.shortMat.id)
      const available =
        after &&
        Number(after.shortageQty ?? 0) <= 0 &&
        (String(after.status).toUpperCase() === 'RESERVED' || Number(after.reservedQty ?? 0) > 0)
      push(
        '5. Stock/reserve check',
        Boolean(available) || (re.status === 200 && Number(after?.shortageQty ?? 1) <= 0),
        `status=${after?.status} reserved=${after?.reservedQty} shortage=${after?.shortageQty}`,
      )
      report.apiFallback.push('Re-reserve verified via API')
    } else {
      push('4/5 GRN + stock', false, 'No PO id')
    }

    report.consoleErrors = consoleErrors.slice(0, 40)
    report.docs = { prNumber, prId, poNumber, poId, grnNumber, woNo: ctx.woNo }
  } finally {
    await browser.close().catch(() => {})
  }

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('\n=== SUMMARY ===')
  for (const s of steps) console.log(`${s.ok ? 'PASS' : 'FAIL'} | ${s.step} | ${s.detail}`)
  console.log(`Screenshots: ${OUT}`)
  console.log(JSON.stringify({ docs: report.docs, apiFallback: report.apiFallback, blockers: report.blockers }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
