# Mobile Phase M1 — Foundation

> **Status:** Implemented (foundation app under `mobile/`)  
> **Date:** 2026-08-03  
> **Verdict:** **READY WITH CONDITIONS**

## Scope delivered

| Item | Status |
|------|--------|
| Expo + React Native + TypeScript + Expo Router | ✅ |
| TanStack Query, Zustand, RHF, Zod, Axios | ✅ |
| Expo Secure Store (tokens only) | ✅ |
| Image Picker / File System deps installed (no feature UI) | ✅ |
| Reanimated + Gesture Handler | ✅ |
| Login / logout / remember / refresh / restore | ✅ |
| Tenant slug on `/api/v1/t/:tenantSlug/` | ✅ |
| Shared API client (GET/POST/PUT/PATCH/DELETE) | ✅ |
| Current user + roles + permissions + module flags | ✅ |
| `can(permission)` engine | ✅ |
| Module loader / home visibility | ✅ |
| Bottom tabs: Home, Tasks, Approvals, Notifications, More | ✅ |
| Home temporary dashboard | ✅ |
| Profile read-only | ✅ |
| Settings (theme/language/about/privacy/logout) | ✅ |
| Design system components | ✅ |
| Loading / error / offline / session expired UX | ✅ |

## Explicitly not built

CRM, Manufacturing, Inventory, HRMS, Accounting, Approvals inbox logic, push, offline sync, camera workflows, barcode.

## How to run

```bash
cd mobile
cp .env.example .env
npm install
node scripts/generate-placeholder-assets.cjs
npm run typecheck
npm run test:unit
npx expo start
```

## Conditions

1. Live login requires a running backend + correct `EXPO_PUBLIC_API_BASE_URL` for device/emulator.
2. Branch / Legal Entity show `—` until scope is returned by `/auth/me` or a scoped profile API.
3. Backend soft gap: refresh may not re-check user ACTIVE (M0 B1).
4. Placeholder PNG icons — replace before store release.
5. Expo prebuild/E2E device matrix not run in this session if host lacks Android/iOS tooling.

## Related docs

- [`MOBILE_ARCHITECTURE.md`](MOBILE_ARCHITECTURE.md)
- [`MOBILE_AUTH.md`](MOBILE_AUTH.md)
- [`MOBILE_DESIGN_SYSTEM.md`](MOBILE_DESIGN_SYSTEM.md)
- [`MOBILE_PHASE_M0_AUDIT.md`](MOBILE_PHASE_M0_AUDIT.md)
