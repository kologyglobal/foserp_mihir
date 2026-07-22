# Phase 8B — Technical Readiness

Checklist from Phase 8A ops / baseline gaps. Mark **UNKNOWN** where this pack has no host evidence.

| # | Item | Target | Status | Evidence / notes |
|---|------|--------|--------|------------------|
| T1 | `prisma-cli validate` | exit 0 | **PASS** | 2026-07-21 Wave 0 close: exit **0** (8B-R-001) |
| T2 | `prisma-cli generate` | exit 0 | **PASS** (prior) | 8A/Wave 0 sessions used generated client; reconfirm on UAT host if regenerating |
| T3 | `migrate status` on pilot DB | Understood; deploy plan | **PASS** (local) | 2026-07-21: local `fos_erp` “Database schema is up to date!” exit **0** (78 migrations). Reconfirm on UAT/prod host before deploy. No force-reset. |
| T4 | Backend `npm run typecheck` | exit 0 | **PASS** | 2026-07-21 Wave 0 close: exit **0** (8B-R-003) |
| T5 | Frontend `npm run typecheck` / build | exit 0 | **PASS** | 2026-07-21 Wave 0 typecheck **0**; Wave 1 reconfirm: `tsc -b --force` **0**, `npm run build` **0** |
| T6 | Backend health JSON on pilot host | `/api/v1/health` JSON | **UNKNOWN** | Prod historically HTML risk — redeploy `.htaccess` |
| T7 | `VITE_USE_API=true` build for pilot | Deployed FE | **UNKNOWN** | |
| T8 | JWT auth + tenant isolation smoke | Cross-tenant negative | **UNKNOWN** | Existing finance/CRM tests; expand later |
| T9 | Manufacturing smoke scripts | phase1–5c / 3c materials | **UNKNOWN** | Prefer over CI-green claim |
| T10 | Inventory 3A smoke | balances + movements | **UNKNOWN** | |
| T11 | Quality 4A/4B smoke | plans + queue | **UNKNOWN** | No incoming |
| T12 | Job Work smoke | dual-mode | **UNKNOWN** | Required before JW in SOP |
| T13 | FG receipt smoke | `POST …/fg-receipt` | **UNKNOWN** | Gate WO close FG step |
| T14 | `MANUFACTURING_ACCOUNTING` off in DB | `isEnabled=false` | **UNKNOWN** | Confirm SQL |
| T15 | `MULTI_CURRENCY` off unless tested | `isEnabled=false` | **UNKNOWN** | |
| T16 | Backup / restore drill | Documented restore | **UNKNOWN** | 8A honesty gap |
| T17 | Monitoring / log access | On-call can read logs | **UNKNOWN** | |
| T18 | TLS / reverse proxy | HTTPS + `/api` proxy | **UNKNOWN** | Host-specific |
| T19 | Upload/storage path writable | CRM/attachments if used | **UNKNOWN** | |
| T20 | Bank connector env locked | No live PSD2 | **UNKNOWN** | Sandbox optional |

**Policy:** T1–T5 are **PASS** on the local engineering environment (Wave 0 close 2026-07-21). Reconfirm T1–T5 on the UAT host before client pilot. Do not mark READY for client pilot while T6–T20 remain UNKNOWN without written waiver. Internal UAT may proceed — see Phase 8C doc (**READY FOR UAT** internal).
