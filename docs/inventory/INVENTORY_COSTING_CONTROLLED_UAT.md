# Inventory Costing — Controlled UAT (UAT-1)

> Companion to `INVENTORY_COSTING_UAT_AUDIT.md`. Automated evidence: `backend/tests/inventory-costing-uat1-controlled.test.ts`.

## How to run

```bash
cd backend
npx vitest run tests/inventory-costing-uat1-controlled.test.ts --pool=forks --maxWorkers=1
# SPA UAT API harness (same checklist flows):
npm run test:inventory-costing-spa-uat
# Inventory↔GL parity (requires INVENTORY_ACCOUNTING + MySQL):
npm run test:inventory-gl-recon-live
```

Requires MySQL. Fixtures create isolated tenants and clean up after (best-effort).

---

## Scenario matrix

### MA — `RM-MS-PLATE-MA`

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| Pre | Method = average | Effective method MA | Automated |
| T1 | Receive 1000 @ 70 | Qty 1000, value 70000, MA 70 | Automated |
| T2 | Receive 500 @ 80 | Qty 1500; MA ≈ 73.3333; stockValue = qty×avg(4dp) | Automated |
| T3 | Issue 600 to WO | Issue at current MA; 1 cost entry | Automated |
| T4 | Return 100 | Return cost entry; MA policy (current avg if no rate) | Automated |
| T5 | Correction issue 10 (new key) | Separate movement; original unchanged | Automated |
| T6 | Idempotent re-post | Still 1 cost entry on original | Automated |
| T7 | MA history API | Before/after derived from cost entries | Automated |
| UI | `/inventory/costing/average` History | Before/after columns | Manual |

### FIFO — `RM-MS-PLATE-FIFO`

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| T1–3 | Receipts 100@70, 100@75, 100@80 | 3 OPEN layers | Automated |
| T4 | Issue 150 | Consume 100@70 + 50@75; value ≈ 10750 (±0.50 rate 2dp) | Automated |
| T5 | Return 50 | Layer restore; ignore caller rate 999 | Automated |
| T6 | Transfer WH-A → WH-B | Receive unit cost = dispatch cost entry | Automated |
| UI | Layers + entry detail | Consumptions visible | Manual |

### Standard — `RM-VALVE-STD`

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| T0 | Receipt without standard | Fail-closed | Automated |
| T1 | Active std 100; receive 100 @ 110 | Inv 10000; variance 1000 | Automated |
| T2 | Issue 10 | Relief @ 100 = 1000 | Automated |
| T3 | Version 105 from Apr | Historical entry stays 100; later issue @ 105 | Automated |
| UI | Standard create | Item lookup (no UUID typing) | Manual |

### Specific — `BO-PUMP-SPEC`

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| T0 | Receipt without identity | Fail | Automated |
| T1 | PA-0001/2/3 at distinct costs | Exact layers | Automated |
| T2 | Issue PA-0002 | 22500 not average | Automated |
| T3 | Return PA-0002 | Restore ≈ 22500 | Automated |
| T4 | Transfer PA-0001 | Cost 20000 preserved | Automated |
| UI | Specific register | Unidentified filter | Manual |

### Method change + isolation

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| Preview | `GET …/method-change/preview` | PASS/WARNING/BLOCKED + GL Not Available | Automated |
| Tenant | Two tenants | Cost entries isolated | Automated |
| UI | Method Change wizard | Readiness → preview → execute | Manual |

---

## Manual UI checklist (controlled)

User: Inventory Manager (`inventory.view_cost` + `inventory.setup.manage` for writes)

**Automated API substitute (2026-07-30):** `npm run test:inventory-costing-spa-uat` walks overview, cost entries, layers, recon, method-change preview, and transfer cost preserve via HTTP/API. That is the accepted READY-gate substitute for live SPA UAT.

**Residual human step (optional product sign-off — not a READY blocker):**

1. Open `/inventory/costing` — overview totals load.
2. MA History — before/after columns populated after MA posts.
3. Standard Costs — search item by code/name (no UUID box).
4. Reconciliation — Inventory value shown; when Inventory Accounting is **off**, GL = **Not Available** (not ₹0); when **on**, GL totals from Inventory↔GL TB (link to `/accounting/inventory-gl-reconciliation`).
5. Method Change — cannot apply without readiness step; blockers listed from API.

---

## Cross-module (deferred to follow-on if not covered by existing suites)

| Flow | Evidence elsewhere |
|------|-------------------|
| GRN → cost entry | `purchase-inventory-posting` + Phase C GRN rate |
| WO material = cost entry | `inventory-costing-golden-path-ma-fifo.test.ts` |
| FG capitalisation | Fuel Tank / mfg scripts |
| Dispatch relief | Dispatch posting suites (COGS GL deferred) |

---

## Rounding policy (engine)

| Field | Precision |
|-------|-----------|
| Balance `avgRate` | 4 dp |
| Movement `rate` / `value` | 2 dp |
| Cost entry `unitCost` | up to 4 dp (often follows posted rate) |
| FIFO blended issue rate | 2 dp → value may be ±0.50 vs exact layer sum |

Frontend must display backend values — never recompute.
