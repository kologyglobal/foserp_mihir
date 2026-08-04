# Mobile Phase M1 — Foundation Plan

> Downstream of Phase M0 audit (`MOBILE_PHASE_M0_AUDIT.md`).  
> Date: **2026-08-03**  
> **Verdict of M0:** READY WITH CONDITIONS → M1 may start with no hard backend rewrite.

---

## 1. Goal

Stand up a **thin Expo + React Native** application that authenticates against the **existing** FOS API, stores tokens securely, loads the current user (permissions + module flags), and presents a **permission-aware navigation shell** — without shipping operational feature workflows yet.

---

## 2. Exact M1 scope (in)

| # | Deliverable | Notes |
|---|-------------|-------|
| 1 | **Expo + React Native** project (TypeScript) | New top-level folder e.g. `mobile/` — **not** WebView wrapping `/m` |
| 2 | **TypeScript** strict enough to match org standards | Shared IDE/tsconfig patterns where practical |
| 3 | **Environment configuration** | Dev / UAT / production API base URLs (`EXPO_PUBLIC_*` or app.config extras) |
| 4 | **API client foundation** | `apiRequest`, envelope parse, `tenantPath`, Bearer inject, timeout, JSON errors |
| 5 | **Login** | `tenantSlug` + email + password → `POST /api/v1/auth/login` |
| 6 | **Token refresh** | `POST /auth/refresh-token`; rotation-safe; single-flight mutex |
| 7 | **Secure storage** | Access + refresh + tenant slug/id + expiry in SecureStore |
| 8 | **Logout** | API logout + wipe storage |
| 9 | **Current-user profile** | `GET /auth/me`; display name/email/roles summary |
| 10 | **Permissions** | Store permission string array from login/me |
| 11 | **Module flags** | `GET /t/:slug/modules` after login |
| 12 | **Module-aware navigation** | Tabs/stack entries only if permission + module enabled (fail-open flags documented) |
| 13 | **Common UI primitives** | Loading, error, empty, primary button, text field, form error list |
| 14 | **Session UX** | Session expired → login screen message |
| 15 | **Health check (optional)** | Hit `/api/v1/health` for connectivity diagnostics |

---

## 3. Explicit M1 out of scope

| Exclusion | Why |
|-----------|-----|
| CRM follow-up lists, call flows | M2 |
| Approvals act/reject | M2 |
| MFG My Work, production post, QC decide | M2 |
| Maintenance, store issue, dispatch pick | M2 |
| Attendance, leave, OT, payslips | No backend |
| Push notifications / FCM | Needs product + backend |
| Offline SQLite / sync queue | Not designed |
| Biometric unlock / PIN lock | Security doc P3 |
| App Store / Play production release train | After M1–M2 UAT |
| Port of `frontend/src/modules/mobile` components | Web-only |
| `packages/api-contracts` monorepo extraction | Optional late M1 / M2 — not required to start |
| Backend multi-module `requireModule` expansion | Parallel hardening track |

---

## 4. Backend blockers before M1 code start

### Hard blockers: **none**

Existing APIs are sufficient:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/t/:tenantSlug/modules
GET  /api/v1/health
```

### Soft conditions (track in M1; fix preferred before broad beta)

| ID | Item | Owner suggestion |
|----|------|------------------|
| B1 | Refresh re-check user/tenant ACTIVE | Backend small patch |
| B2 | Document LAN dev URL (device ≠ `localhost` host) | Mobile env docs |
| B3 | Decide fail-open vs fail-closed UX for missing module flags | Product + mobile |
| B4 | Avoid enabling prod Swagger solely for mobile | Export OpenAPI in CI instead |

---

## 5. Architecture sketch

```text
[Expo App]
  AuthProvider ── SecureStore
       │
       ▼
  ApiClient ── fetch ──► /api/v1/auth/*
                tenantPath(`/modules`) etc.
       │
       ▼
  Navigation (auth stack | app shell)
       │
       ├─ Home (placeholder)
       ├─ Profile (read-only me)
       └─ Module placeholders gated by permissions
```

**Rules:**

- No dual-mode demo stores.
- No mixing seed data with API.
- Navigation hide must pair with server 403 handling on any accidental deep link.

---

## 6. Recommended mobile folder layout (proposed)

```text
mobile/
  app/ or src/
    api/
      client.ts
      authApi.ts
      modulesApi.ts
      types.ts          # envelope, session, errors
    auth/
      AuthContext.tsx
      LoginScreen.tsx
      secureStorage.ts
    navigation/
      RootNavigator.tsx
      AppShell.tsx
    screens/
      HomeScreen.tsx
      ProfileScreen.tsx
      PlaceholderModuleScreen.tsx
    components/
      LoadingState.tsx
      ErrorState.tsx
      EmptyState.tsx
    config/
      env.ts
  app.config.ts
  package.json
  README.md             # how to point at local API
```

Do **not** put private keys here. Public env only.

---

## 7. API client behaviors to port carefully from web

From `frontend/src/services/api/client.ts` (logic only, not storage):

| Behavior | Port? |
|----------|-------|
| Single-flight refresh | Yes |
| 401 → refresh once → retry original | Yes |
| Proactive expiry skew (~60s) | Yes |
| `expiresIn` as milliseconds | Yes (verify against BE) |
| `localStorage` / `window` events | **No** |
| HTML SPA-proxy detection | Optional |
| Blob download helper | Later features |

---

## 8. Navigation seed (permission-gated placeholders)

Suggested shell modules for **placeholders only** (labels only in M1; implement in M2+):

| Placeholder | Gate example permissions | Module flag |
|-------------|--------------------------|-------------|
| Tasks / Approvals | purchase approve / gate / finance approve (any) | purchase / accounting / gate |
| Shopfloor | `manufacturing.operator.my_work` | manufacturing |
| Quality | `quality.view` | quality (flag soft) |
| Maintenance | `maintenance.view` or create | maintenance |
| CRM Follow-ups | `crm.follow_up.view` | crm (flag soft) |
| Store issue | `manufacturing.materials.issue` | manufacturing |

Exact codes must be validated against `backend/src/constants/permissions.ts` during implementation.

---

## 9. Testing plan (M1)

| Test | Method |
|------|--------|
| Login happy path | Device/emulator against local BE |
| Bad password / inactive user | Expect safe error message |
| Refresh after access expiry | Force short TTL or wait |
| Concurrent requests on expired access | No double-refresh race losses |
| Logout | RT revoked; next call 401 |
| Wrong tenantSlug | Login fails; no partial session |
| Module nav | User without purchase does not see purchase placeholder |
| Typecheck | `tsc` in mobile package |
| Manual only OK for M1 | Full detox e2e deferred |

---

## 10. Success criteria

M1 is **done** when:

1. App builds on Android **or** iOS simulator (at least one platform documented).
2. User can log in with tenant slug + credentials against live API.
3. Tokens survive app restart in SecureStore and refresh works.
4. Logout clears session.
5. Profile shows identity from `/auth/me`.
6. Nav hides at least one module the user cannot access (demo with two roles).
7. No operational write screens shipped as “done” features.
8. Mobile README documents env vars and LAN setup.
9. Project docs updated (`PROJECT_STATUS`, `REMAINING_WORK`, changelog).

---

## 11. Effort estimate (indicative)

| Workstream | Effort |
|------------|--------|
| Expo bootstrap + TS + env | 0.5–1 day |
| API client + secure storage + refresh | 1–2 days |
| Login + auth state + profile | 1 day |
| Modules fetch + shell nav + UI states | 1 day |
| Docs + UAT notes | 0.5 day |
| **Total** | **~4–6 engineer days** |

Optional parallel: B1 refresh ACTIVE check (~0.5 day backend).

---

## 12. M2 preview (not committed)

After M1 gate:

1. Follow-ups list/complete (API-native)
2. My Work + material issue (idempotencyKey discipline)
3. QC queue decide
4. Maintenance report + multipart photo
5. Multi-source approvals read view

HR and push remain gated on greenfield backend.

---

## 13. Decision log (M0 → M1)

| Decision | Choice |
|----------|--------|
| Auth style | Keep body JWT refresh (no cookies) |
| Shared contracts package | Optional; start mobile-local |
| Reuse web mobile SPA | **No** as RN UI base; yes as product map |
| Demo mode on mobile | **Forbidden** as primary architecture |
| Verdict | **READY WITH CONDITIONS** for M1 |
