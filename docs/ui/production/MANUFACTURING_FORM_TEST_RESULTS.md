# Manufacturing Form UX — Test Results

Date: 2026-07-21
Wave: FORM-A (foundation) + FORM-B (core production) + FORM-C (posting drawers) + FORM-D (job work) shipped.

## Commands executed

| Command | Result |
|---|---|
| `npm run typecheck` (frontend, `tsc -b --noEmit`) | ✅ Pass (0 errors), run twice — after foundation and after all form edits |
| `npm run test:manufacturing-forms` (new smoke, 46 checks) | ✅ 46/46 pass |
| `npm run build` (frontend production build) | ✅ Pass (pre-existing dynamic-import warnings only, unrelated to this wave) |

## Smoke coverage (`scripts/test-manufacturing-forms-smoke.ts`)

- FORM-A: shell + primitives exist, barrel exports complete, shell composes
  `OperationalPageShell` + `ErpCommandBar` (no bespoke chrome).
- FORM-B: WO create readiness panel (server `getProfileReadiness`), WO detail
  next-best-action banner, info side panel, lifecycle-specific primary actions,
  close-readiness complete dialog, daily-update selector-based add-line + submit preview.
- FORM-C: material issue/return drawers with posting impact + immutability warnings,
  FG receipt drawer with eligibility → preview → idempotent post.
- FORM-D: job work reconciliation equation + unexplained difference surfacing.
- Permissions: `canPostFgReceipt` / `canViewFgReceipts` wired into the WO permission hook.
- Docs: all required `docs/ui/production/*` files present.

## Not executed this wave (honest gaps)

- **Live browser UAT** (desktop/tablet screenshots, route-refresh, stale-data
  interaction) — requires a running backend + seeded tenant; not run in this session.
- **Backend live tests** (`npm run test:*` manufacturing suites against MySQL) — no
  backend behaviour was changed this wave except an additive query param on the
  close-readiness client call; server code untouched.
- **Visual regression / screen-reader audit** — pending FORM-F certification wave.

## Regression risk assessment

- No manufacturing business workflow, posting logic, or backend route was modified.
- Changed frontend surfaces: `ApiWorkOrderCreatePage`, `ApiWorkOrderDetailPage`,
  `DailyUpdatePage`, `JobWorkDetailPage`, `manufacturingApi.getCloseReadiness` (additive
  optional param), `permissions/manufacturing.ts` (two additive hook fields).
- Demo mode untouched (`VITE_USE_API=false` paths unchanged).
