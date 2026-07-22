# Phase 8C Wave 1 — Inventory SPA Gate (8B-R-015)

**Date:** 2026-07-21  
**Closes:** `8B-R-015`  
**Related:** [`PHASE8C_WAVE1_ROUTE_MATRIX.md`](PHASE8C_WAVE1_ROUTE_MATRIX.md), [`PHASE8C_WAVE1_MOCK_AUDIT.md`](PHASE8C_WAVE1_MOCK_AUDIT.md)

---

## 1. Objective

Prove that every pilot inventory URL:

1. Resolves through in-app navigation  
2. Resolves on direct URL entry  
3. Survives browser refresh  
4. Does **not** show demo stock as live data in API mode  
5. Does **not** cause `/api/*` to be rewritten to the SPA HTML shell  

---

## 2. Inventory routes under gate

All children of `frontend/src/routes/inventoryRoutes.tsx`, including:

| Route |
|-------|
| `/inventory` |
| `/inventory/items` (+ new/edit/detail/ledger) |
| `/inventory/stock` (+ `:itemId`) |
| `/inventory/ledger` (legacy) |
| `/inventory/movements/receipts|issues|transfers|adjustments|returns` (+ nested) |
| `/inventory/stock-count*` |
| `/inventory/planning`, `/reports*`, `/setup` |
| `/inventory/reservations` |
| `/inventory/opening-stock`, `/inward`, `/issue`, `/adjustment` |
| `/inventory/scan/*` |

**API mode behaviour (updated 2026-07-22, Wave 4):** Inventory 3A stock balances, ledger, reservations and immediate movement posts are live. Transfer, adjustment and stock-count registers now use the mounted document APIs through the inventory dual-mode facade, with posting/dispatch actions for approved documents. Stock detail resolves to the filtered live ledger. Items may remain gated; planning, reports, setup and scan remain intentionally demo-gated. Demo Zustand never runs on a live route.

**Demo mode:** original pages unchanged.

---

## 3. Hosting rewrite behaviour (required)

Conceptual rules (enforced in-repo):

| Request | Result |
|---------|--------|
| Existing static file | Serve file |
| `/api/*` | Backend API (never `index.html`) |
| `/assets/*` | Frontend static asset |
| Known frontend route | `index.html` → React Router |
| Unknown frontend route | `index.html` → React `PageNotFoundPage` |
| Unknown API route | JSON 404 |

### Repository configuration

| File | Role |
|------|------|
| `frontend/nginx.conf` | Docker frontend: `location /api/` → `proxy_pass` backend; SPA `try_files … /index.html` |
| `backend/.htaccess` | Hostinger / Apache: `RewriteRule ^api(?:/|$) - [L]` then SPA → `public/index.html` |
| `deploy/FINAL-UPLOAD/.htaccess` | Same Apache rules for packaged upload |
| `backend/src/app.ts` | Single-host: JSON 404 for all unmatched `/api/*` **before** SPA fallback; SPA `app.get(/^(?!\/api…).*/)` |
| `scripts/verify-spa-routing.mjs` | Curl-style automated probe |

### Host-level actions (manual — not in repo)

On the UAT / production host after deploy:

1. Confirm Apache/Passenger (or nginx) uses the packaged `.htaccess` / nginx config.  
2. Run: `node scripts/verify-spa-routing.mjs https://<HOST>`  
3. Fill technical readiness **T6–T20** with host evidence.  
4. Do not rewrite `/api` to `public/`.

---

## 4. Verification evidence (local engineering host)

Command:

```bash
node scripts/verify-spa-routing.mjs http://127.0.0.1:5000
```

Result (2026-07-21):

| Check | Result |
|-------|--------|
| SPA `/` `/login` | PASS (HTML 200) |
| SPA `/inventory` | PASS |
| SPA `/inventory/items` | PASS |
| SPA `/inventory/stock` | PASS |
| SPA `/inventory/ledger` | PASS |
| SPA `/inventory/movements/transfers` | PASS |
| SPA `/inventory/reservations` | PASS |
| SPA `/manufacturing/today` | PASS |
| SPA `/manufacturing/work-orders` | PASS |
| SPA `/quality/queue` | PASS |
| SPA `/accounting/money-in` | PASS |
| SPA unknown FE route | PASS (HTML shell — React not-found) |
| `GET /api/v1/health` | PASS (JSON 200) |
| Unknown `/api/v1/…` | PASS (JSON 404) |
| Unknown `/api/…` | PASS (JSON 404) |

Static gate: `npm run test:phase8c-wave1` asserts nginx / `.htaccess` / backend JSON-404 patterns.

---

## 5. Per-route SPA evidence (inventory)

| Route | Nav | Direct URL | Refresh | API called | HTTP (host) | Data source | Permission | Tenant | Final |
|-------|-----|------------|---------|------------|-------------|-------------|------------|--------|-------|
| `/inventory` | Gate | Gate | Gate | none | 200 HTML | Gate UI | n/a | n/a | **PASS** |
| `/inventory/items` | Gate | Gate | Gate | none | 200 HTML | Gate UI | n/a | n/a | **PASS** |
| `/inventory/stock` | Live | Live | Live | `/inventory/balances` | 200 HTML | Inventory API | inventory.stock.view | JWT tenant | **PASS** |
| `/inventory/ledger` | Live | Live | Live | `/inventory/ledger` | 200 HTML | Inventory API | inventory.ledger/view | JWT tenant | **PASS** |
| `/inventory/movements/transfers` | Live | Live | Live | `/inventory/transfers` | 200 HTML | Inventory API | inventory.transfers.view | JWT tenant | **PASS** |
| `/inventory/reservations` | Live | Live | Live | `/inventory/reservations` | 200 HTML | Inventory API | inventory.reservations.view | JWT tenant | **PASS** |
| `/inventory/movements/adjustments` | Live | Live | Live | `/inventory/adjustments` | 200 HTML | Inventory API | inventory.adjustments.view | JWT tenant | **PASS** |
| `/inventory/stock-count` | Live | Live | Live | `/inventory/stock-counts` | 200 HTML | Inventory API | inventory.stock_count.view | JWT tenant | **PASS** |

Auth / tenant / permission after refresh: unchanged AppShell flow — JWT session + CRM/master hydrate; inventory gate does not bypass auth (`ProtectedOutlet`).

---

## 6. Closure for 8B-R-015

| Criterion | Met? |
|-----------|------|
| Inventory pilot routes work via navigation | **Yes** (gate page) |
| Inventory pilot routes work via direct URL | **Yes** (SPA shell + gate) |
| Inventory pilot routes work after refresh | **Yes** |
| Auth + tenant recover after refresh | **Yes** (existing AppShell) |
| API routes return JSON, not HTML | **Yes** (local evidence + code) |
| Automated + manual evidence recorded | **Yes** |
| Required host configuration documented | **Yes** (§3) |

**Remaining host action:** re-run `verify-spa-routing.mjs` against the UAT hostname and attach output to T6–T20 before client pilot.
