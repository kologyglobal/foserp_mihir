# GST Books Period UAT

**Date:** 2026-08-05  
**Verdict:** **GST_BOOKS_UAT_READY_WITH_CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · LIVE GSTN/GSP  

---

## Harness

```bash
cd backend
npm run uat:gst-books
# or keep tenant for SPA: GST_UAT_KEEP=1 npx tsx scripts/uat-gst-books-period.ts
```

Script: `backend/scripts/uat-gst-books-period.ts`

Creates an isolated tenant, TRADING CoA + GST mappings, sample SI GST ledger + matching JOURNAL GL, then walks books engines.

---

## Run results (local `fos_erp`, 2026-08-05)

| Step | Status | Notes |
|------|--------|--------|
| finance_bootstrap | PASS | LE + FY + CoA + GST mappings |
| seed_ledger_gl | PASS | UAT SI ledger + balanced voucher |
| p17_data_quality | PASS/WARN | Freeze checklist on seeded rows |
| p18_gl_recon | PASS | OUTPUT_CGST/SGST MATCH (₹900) |
| p16_rate_ops_capability | PASS | Feature on |
| p5_gstr1_lock | PASS | Prepare + lock |
| p5_gstr3b_lock | PASS | Prepare + lock |
| p12_portal_simulated | PASS | `ACCEPTED_SIMULATED` + `SIM-ARN-*` |
| p13_period_health | PASS | Pre-file READY; liability ₹1800 |
| p13_go_live_honesty | PASS | Never FULL GST COMPLIANT |
| honest_matrix | PASS | P17/P18 matrix honest |

**Overall:** zero FAIL steps → **GST_BOOKS_UAT_READY_WITH_CONDITIONS**.

---

## Prerequisites (ops — already applied on this env)

1. `npx tsx scripts/prisma-cli.ts migrate deploy` through Phase 18  
2. `npx prisma generate`  
3. `npm run db:sync-permissions`  
4. MySQL reachable; `GST_PORTAL_FILING_PROVIDER_MODE=SIMULATED` (default in harness)

---

## Still not covered by this UAT

| Area | Status |
|------|--------|
| LIVE IRN / e-Way | Deferred (hard-gated) |
| LIVE portal submit | Deferred (`ACCEPTED_SIMULATED` only) |
| Offline GSTR-2B import file UI | Not exercised |
| Real SPA click path | Optional with `GST_UAT_KEEP=1` |
| Production tenant data | Isolated seed only |

---

## Re-run advice

- Run after migration/permission changes.  
- Fail exit code `1` if any step is FAIL.  
- Keep tenants for browser debugging with `GST_UAT_KEEP=1` (manual cleanup later).
