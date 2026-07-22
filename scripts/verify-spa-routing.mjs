#!/usr/bin/env node
/**
 * Phase 8C Wave 1 — SPA rewrite verification (8B-R-015).
 *
 * Verifies the hosting layer (nginx / Apache .htaccess / single-host Express)
 * enforces:
 *   - Frontend routes (deep links + refresh) return the SPA HTML shell
 *   - /api/v1/health returns JSON
 *   - Unknown /api routes return a JSON 404 (never the SPA HTML)
 *   - Unknown frontend routes return the SPA shell (React renders not-found)
 *
 * Usage:
 *   node scripts/verify-spa-routing.mjs                       # http://127.0.0.1:5000
 *   node scripts/verify-spa-routing.mjs https://erp.example.com
 */

const host = (process.argv[2] ?? 'http://127.0.0.1:5000').replace(/\/$/, '')

const SPA_ROUTES = [
  '/',
  '/login',
  '/inventory',
  '/inventory/items',
  '/inventory/stock',
  '/inventory/ledger',
  '/inventory/movements/transfers',
  '/inventory/reservations',
  '/manufacturing/today',
  '/manufacturing/work-orders',
  '/quality/queue',
  '/accounting/money-in',
  '/this-route-does-not-exist-8c-wave1',
]

const API_CHECKS = [
  { path: '/api/v1/health', expectStatus: 200, expectJson: true, label: 'health returns JSON' },
  { path: '/api/v1/non-existent-route-8c-wave1', expectStatus: 404, expectJson: true, label: 'unknown API route returns JSON 404' },
  { path: '/api/non-existent-top-level', expectStatus: 404, expectJson: true, label: 'unknown top-level /api path returns JSON 404' },
]

let failures = 0

function report(ok, label, detail) {
  const mark = ok ? 'PASS' : 'FAIL'
  if (!ok) failures += 1
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`)
}

async function probe(path) {
  const res = await fetch(host + path, { redirect: 'manual' })
  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()
  return { status: res.status, contentType, body }
}

for (const route of SPA_ROUTES) {
  try {
    const { status, contentType, body } = await probe(route)
    const isHtmlShell = contentType.includes('text/html') && /<div id="root">|<!doctype html/i.test(body)
    report(status === 200 && isHtmlShell, `SPA route ${route}`, `status=${status} content-type=${contentType}`)
  } catch (err) {
    report(false, `SPA route ${route}`, String(err))
  }
}

for (const check of API_CHECKS) {
  try {
    const { status, contentType, body } = await probe(check.path)
    const isJson = contentType.includes('application/json')
    const isHtml = /<html|<!doctype/i.test(body)
    const ok = status === check.expectStatus && isJson && !isHtml
    report(ok, check.label, `status=${status} content-type=${contentType}`)
  } catch (err) {
    report(false, check.label, String(err))
  }
}

console.log(failures === 0 ? `\nAll SPA routing checks passed against ${host}` : `\n${failures} check(s) FAILED against ${host}`)
process.exit(failures === 0 ? 0 : 1)
