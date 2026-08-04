# Mobile Phase M0 — Repository and API Readiness Audit

> **Status:** Complete (docs only)  
> **Date:** 2026-08-03  
> **Scope:** Read-only audit of existing FOS backend + frontend for a future React Native / Expo app.  
> **Explicit non-goals:** No Expo project, no mobile screens, no push, no offline DB, no app-store builds.

**Related docs**

| Doc | Purpose |
|-----|---------|
| [`MOBILE_API_READINESS_MATRIX.md`](MOBILE_API_READINESS_MATRIX.md) | Feature × API/permission/risk matrix |
| [`MOBILE_SECURITY_REQUIREMENTS.md`](MOBILE_SECURITY_REQUIREMENTS.md) | Security recommendations (not implemented) |
| [`MOBILE_PHASE_M1_PLAN.md`](MOBILE_PHASE_M1_PLAN.md) | Exact M1 foundation scope |

---

## Final verdict

### **MOBILE PHASE M0 — READY WITH CONDITIONS**

| Gate | Result |
|------|--------|
| Auth suitable for native Bearer clients | **Yes** |
| Multi-tenant `/api/v1/t/:tenantSlug/…` usable from mobile | **Yes** |
| Permissions available after login | **Yes** |
| Module flags available via API | **Yes** (partial backend hard-gate) |
| Core ops APIs exist (MFG / QC / maintenance / store / dispatch / CRM follow-ups / purchase approvals) | **Yes** |
| Unified notifications API | **No** — greenfield (not M1 blocker) |
| HR (attendance / leave / OT / payslips) | **No** — greenfield (defer past M1) |
| Expo app or shared monorepo package already exists | **No** — expected; M1 creates foundation |
| Hard backend rewrite required for M1 | **No** |

**Conditions (must fix or consciously accept before/during M1):**

1. **Mobile M1 is API-only** — never replicate web `VITE_USE_API=false` demo stores as authority.
2. **Harden refresh** — re-check user/tenant `ACTIVE` on refresh (soft security gap today).
3. **Use SecureStore** — never port `localStorage` token storage patterns as-is.
4. **Do not port** `frontend/src/modules/mobile` UI tree blindly — treat as product map + API reference only.
5. **Defer HR/payroll and push notifications** — out of M1 scope.
6. **Optional but recommended before M2 ops screens:** publish OpenAPI artifact; add device metadata on refresh tokens.

---

## 1. Repository findings

### Layout (current)

```text
Kology-ERP/
├── frontend/                 # Vite React SPA (active web + responsive /m/* shell)
├── backend/                  # Express + Prisma + MySQL
├── trailer-erp/              # Legacy parallel FE tree (do not use for mobile)
├── docs/                     # Project memory + this suite
├── docker-compose.yml
├── package.json              # Host scripts only — no workspaces / packages/*
└── (no top-level mobile/ or Expo app)
```

| Area | Finding |
|------|---------|
| **Monorepo packages** | None. No `packages/api-contracts`, no yarn/npm workspaces for shared types. |
| **Root `package.json`** | Hostinger build/start only; `dev:frontend` / `dev:backend` wrappers. |
| **Backend** | Auth, RBAC, CRM, masters, purchase, inventory, manufacturing, quality, dispatch, gate, maintenance, accounting, modules, security sessions. |
| **Frontend API mode** | JWT + `VITE_USE_API=true`; bridges replace Zustand seeds. |
| **Existing “Mobile”** | Responsive SPA under `/m/*` (`frontend/src/routes/mobileRoutes.tsx`), **not** React Native. |
| **Swagger** | Dev-only UI at `/api/docs`; hand-written + stubs (`backend/src/config/swagger.ts`). |
| **Attachments** | Local filesystem (`CRM_UPLOAD_DIR`, maintenance/dispatch dirs); cloud/signed URL deferred. |
| **Deploy** | Docker Compose + Hostinger single-host; TLS expected at reverse proxy (`docs/DEPLOYMENT.md`). |

### Stack relevance to Expo

| Web layer | Mobile mapping |
|-----------|----------------|
| React 19 + TS SPA | Expo RN + TypeScript (new app) |
| Zustand dual-mode stores | **Do not copy dual-mode**; API client + React state |
| `fetch` + Bearer | Same against `/api/v1` |
| React Router `/m/*` | Native stacks/tabs (rewrite) |
| Tailwind mobile CSS | Native StyleSheet / design tokens |

---

## 2. Authentication audit

### Endpoints (base `/api/v1/auth` — **not** under tenant path)

| Method | Path | Mobile usable? | Notes |
|--------|------|----------------|-------|
| `POST` | `/login` | **Yes** | Body: `{ tenantSlug, email, password }` → access + refresh + user (roles, permissions) |
| `POST` | `/refresh-token` | **Yes** | Body: `{ refreshToken }` → rotated pair + `expiresIn` |
| `POST` | `/logout` | **Yes** | Bearer; optional body RT revokes one, else all for user |
| `GET` | `/me` | **Yes** | User + tenant profile + permissions |
| `PATCH` | `/me` | **Yes** | Profile fields only (not full HR master) |
| `POST` | `/change-password` | **Yes** | Revokes **all** refresh tokens |
| `POST` | `/forgot-password` | Yes (later) | Rate limited; email or dev reset token |
| `POST` | `/reset-password` | Yes (later) | Revokes all RTs |
| `POST` | `/accept-invitation` | Later | First-time password set |
| `GET` | `/login-directory` | **No (prod)** | Dev/test only |

Success envelope: `{ success, message, data, meta }`.

### Token model

| Token | Storage (server) | Claims | Default TTL |
|-------|------------------|--------|-------------|
| Access JWT | Stateless | `sub`, `tenantId`, `tokenType: 'access'` | `JWT_ACCESS_EXPIRES_IN` = `15m` |
| Refresh JWT | DB row (`RefreshToken`); raw token bcrypt-hashed; `jti` = row id | `sub`, `tenantId`, `jti`, `tokenType` | `7d` |

- **Delivery:** JSON body only — **no HTTP-only cookies**, no cookie-parser CSRF stack.
- **Rotation:** each refresh revokes old RT and issues a new pair.
- **Client (web today):** `localStorage` key `fos-erp-auth` — `frontend/src/services/api/client.ts`.

### Disabled user / lock / session revoke

| Case | Behavior |
|------|----------|
| Login: user not `ACTIVE` | Rejected |
| Lockout / permanent block | RTs revoked on policy path |
| Tenant suspended | Login rejected |
| Password change/reset | All RTs revoked |
| Admin deactivate / force logout | `revokeUserSessions` |
| Authenticated privileged routes | `attachRequestContext` requires `status: 'ACTIVE'` |
| Admin session list | `…/security/sessions` |

**Gap:** `refresh()` validates RT hash + expiry and rotates, but **does not re-load user/tenant status** before issuing a new access token (`auth.service.ts` `refresh`). In normal admin flows RTs are revoked first, so risk is residual (missed revoke path). **Recommend harden before wide mobile rollout.**

### Tenant selection & multi-tenant paths

```text
Login body: tenantSlug
JWT: tenantId
Work APIs: /api/v1/t/:tenantSlug/…   (FE default)
           /api/v1/tenants/:tenantId/… (UUID twin)
```

Middleware resolves slug → tenant and **requires JWT `tenantId` match** (unless Super Admin). Never trust `tenantId` from request bodies.

### Browser-only assumptions (must NOT reuse on native)

| Assumption | Where | Native alternative |
|------------|-------|--------------------|
| `localStorage` for tokens | `client.ts` | Expo SecureStore / Keychain |
| `sessionStorage` notices | `client.ts` | In-app alert state |
| `window` CustomEvent | `client.ts` | App-level session context |
| `window.location` API host rewrite | `environment.ts` | Explicit env config per build |
| SPA redirect to `/login` | `ApiAuthGate` | Auth stack navigator |
| Optional CORS Origin | SPA only | Native typically omits Origin; backend already allows missing origin |

### Minimum backend changes for secure mobile auth

| Priority | Change | M1 blocker? |
|----------|--------|-------------|
| P0 | **None** — existing Bearer login/refresh/logout/me is sufficient for M1 | No |
| P1 | Re-check user `ACTIVE` + tenant status on **refresh** | Recommended before scale |
| P2 | Optional `deviceName` / `client` / `appVersion` on login store on RT row | No |
| P2 | Light rate-limit on refresh in prod (today skipped by limiter) | No |
| P2 | Export OpenAPI artifact (CI) without enabling prod Swagger UI | No |
| — | Switch to cookie sessions | **Do not** for mobile |

---

## 3. API client audit

### Frontend structure (reference only)

| File | Role |
|------|------|
| `frontend/src/services/api/client.ts` | Session, refresh single-flight, `apiRequest`, `tenantPath`, blob download |
| `frontend/src/services/api/authApi.ts` | Auth endpoints |
| `frontend/src/services/api/apiErrors.ts` | Error helpers |
| `frontend/src/services/api/*Api.ts` | ~35 domain modules |
| Bridges | `crmApiBridge`, `masterApiBridge`, etc. — web-store oriented |

### Conventions to preserve on mobile

| Concern | Convention |
|---------|------------|
| Base URL | `{host}/api/v1` |
| Auth header | `Authorization: Bearer <accessToken>` |
| Tenant path | `/t/${tenantSlug}${resourcePath}` |
| Error shape | `{ success: false, message, code?, errors?: [{ field, message }] }` |
| Pagination | Query `page`, `limit` (max 100); meta `{ page, limit, total, totalPages }` (some finance schemas use `pageSize`) |
| Versioning | Path prefix `/api/v1` only |
| Idempotency | **Module-specific**: body `idempotencyKey` and/or header `Idempotency-Key` (finance allocations) — not global middleware |

### Shared package recommendation

| Option | Recommendation |
|--------|----------------|
| **`packages/api-contracts`** (Zod/TS types: auth, envelope, pagination, error codes) | **Yes for M2+ multi-client**; optional for late-M1 |
| OpenAPI codegen from CI export | Good alternative if monorepo package delay |
| Copy types only inside Expo for first spike | Acceptable **short-term** for M1 if gated to auth + envelope |

**Do not move code in M0/M1 blindly.** Start M1 with a **mobile-local API client** mirroring `authApi` + `client` patterns; introduce `packages/api-contracts` when mobile + web share stable DTOs.

### Duplication risk

- Auth session interfaces live on FE; validation schemas on BE Zod.
- Domain types duplicated between FE bridges and BE DTOs.
- Mobile must not invent a third response shape — match envelope.

---

## 4. Feature readiness (summary)

Full matrix: [`MOBILE_API_READINESS_MATRIX.md`](MOBILE_API_READINESS_MATRIX.md).

| Tier | Features |
|------|----------|
| **API solid — build mobile later** | CRM follow-ups, MFG My Work, daily production, QC kiosk queue, maintenance tickets, material issue/return, dispatch pick, purchase/gate approvals |
| **Fragmented** | Unified approval inbox (siloed by domain) |
| **Missing entirely** | Notifications service; attendance; leave; overtime; payslips; employee HR master/docs |
| **Partial** | Employee = auth user profile only |

---

## 5. Permissions and module flags

| Capability | Status |
|------------|--------|
| Permissions on login/me | **Yes** — string array from roles |
| Permissions re-resolved per request | **Yes** — not stale JWT claims for RBAC |
| Module flags list API | **Yes** — `GET …/modules` (authenticated) |
| Module flag toggle | `PUT …/modules/:moduleKey` + `module.manage` |
| Missing flag semantics | **Fail-open** (enabled) |
| `requireModule` hard gate | **Only** purchase, manufacturing, maintenance |
| Nav-only FE checks | Widespread — mobile must still hit APIs; hide ≠ secure |
| LE / branch / warehouse scopes | Admin APIs exist; **not** on login/me payload; opt-in per module (CRM org-scope helper) |

**Mobile rule:** build navigation from permissions + module flags; **every write path must fail closed on backend 403**.

---

## 6. File / photo upload audit

| Domain | Transport | Limits | Mobile notes |
|--------|-----------|--------|--------------|
| CRM attachments | JSON **base64** | Master MIME/size + `CRM_MAX_UPLOAD_BYTES` | Heavy bandwidth; auth binary GET (no signed public URL) |
| Maintenance photos | **multipart** `file` | Images, ~8 MB | Preferred pattern for camera capture |
| Dispatch POD | JSON **base64** | Schema MIME/kind | OK but encoding heavy |
| Item master image | multipart | image/* | Admin-ish |
| QC inspection photos | **None** | Plan can require photo flag only | **Gap** for factory QC mobile |
| MFG issue report | string reference only | No blob | **Gap** |
| Employee documents | **None** | — | HR deferred |
| Signed / expiring download URLs | **None** | Auth’d streams only | Cache strategy must use authed downloads |

Storage is **local FS** per tenant; multi-device mobile is fine if API host is reachable. Camera upload should prefer multipart endpoints (maintenance) and plan CRM multipart later if needed.

---

## 7. Notification readiness

| Component | Present? |
|-----------|----------|
| Prisma Notification model | **No** |
| List / unread / mark-read API | **No** |
| Deep-link payload design | **No** (product design needed) |
| Push (FCM/APNs) device registry | **No** |
| Purchase “notifications” tab | ON_HOLD placeholder only |

**Candidate push events (later phases, not M0/M1):**

- Approval pending (purchase / finance / gate)
- Task / job assignment (MFG My Work)
- QC required (kiosk queue)
- Machine breakdown (maintenance ticket REPORT)
- Leave approved/rejected — **requires HR**
- Payslip generated — **requires payroll**
- Material shortage — ties to inventory/MFG shortage flows

---

## 8. Offline readiness

| Action (future) | Idempotency / conflict today | Duplicate risk if offline retry |
|-----------------|------------------------------|----------------------------------|
| Material issue | Body `idempotencyKey` **required** | Low if client reuses key |
| Material return | Optional key | Medium without key |
| Dispatch pick / post | Optional body keys on phase7c2 | Medium |
| Maintenance ticket / photo | Not universal idempotency | Medium (double report) |
| CRM follow-up complete | Standard CRUD | Medium |
| Daily production post | Module-specific | Medium |
| QC decide | Stateful transitions | Medium–high without OCC |
| Finance postings | Stronger keys + some `expectedUpdatedAt` | Low when keys used |
| Attendance/leave drafts | N/A (no API) | N/A |

**Offline UI on web `/m/*`:** banners/messages only — **no** durable offline write queue, SW, or conflict UX.

M1 stays **online-first**. Document client UUID generation for posting APIs early.

---

## 9. Existing mobile CRM / `/m/*` assessment

| Question | Answer |
|----------|--------|
| Type | **Responsive web SPA** (React Router under `/m`) |
| PWA? | **No** product PWA surface found |
| React Native / Expo? | **No** |
| Dual-mode | Yes — `VITE_USE_API` |
| CRM follow-ups/leads UI | Largely store/demo-path; web CRM sync hydrates API when configured |
| Shopfloor / QC kiosk / inventory / gate / GRN / dispatch / approvals | API-capable in API mode |
| Reuse for Expo | **API contracts, permission codes, domain flows** — **not** components or Tailwind |

**Do not** fork `/m` into a “native wrapper” WebView product as the long-term strategy. M1 starts a native client.

Routes map: `frontend/src/routes/mobileRoutes.tsx` (home, gate, grn, material issue/return, kiosk/shop-floor, qc, dispatch, job-work, approvals, crm/*).

---

## 10. Environment and deployment (mobile requirements)

| Concern | Requirement |
|---------|-------------|
| Dev API URL | e.g. `http://<LAN-IP>:5000/api/v1` (device cannot use host-only `localhost` to reach host) |
| UAT / prod API URL | HTTPS base URLs from build-time config (`EXPO_PUBLIC_API_BASE_URL` or equivalent) |
| HTTPS | Production / UAT **must** use TLS |
| CORS | Primarily SPA; native typically fine without Origin; Expo web/tunnel may need allowlist later |
| Tenant identification | User enters **tenant slug** (same as web login) |
| App version / build metadata | Client header `X-Client: fos-mobile/<version>` recommended |
| Secrets | **No** JWT secrets, DB passwords, SMTP credentials in mobile bundle — public API URL + tenant slug only |

---

## 11. Security (summary)

Full recommendations: [`MOBILE_SECURITY_REQUIREMENTS.md`](MOBILE_SECURITY_REQUIREMENTS.md).

Highlights: SecureStore for tokens; logout clears local + calls API; prefer revoke-all when device lost; mask bank/payroll when HR ships; no screenshots policy where platform allows for payroll; production HTTPS only; never log tokens/PII.

---

## 12. Backend blockers

### Must fix before M1? — **None (hard)**

### Should fix before ops-heavy mobile (M2+) / before scale-out

| ID | Blocker | Severity |
|----|---------|----------|
| B1 | Refresh does not re-validate user/tenant ACTIVE | Medium |
| B2 | No in-app notification model/API | Medium (product) — not M1 |
| B3 | No HR APIs for attendance/leave/OT/payslip | High for HR mobile — out of M1 |
| B4 | QC/issue photo upload incomplete | Medium for factory apps |
| B5 | Module flags not enforced on all modules | Medium (security depth) |
| B6 | Scopes not returned on login/me | Low–med for scoped CRM users |
| B7 | Fragmented approvals (no unified inbox) | Low–med UX |
| B8 | OpenAPI incomplete / not published prod | Low for M1; medium for codegen |

---

## 13. Recommended shared code (path)

```text
M1: mobile/app local api client (auth + envelope + tenantPath)
M1–M2 (optional): packages/api-contracts { envelope, auth, pagination, error codes }
Later: domain modules or OpenAPI codegen — avoid mass FE shared modules with window/localStorage
```

---

## 14. Exact M1 scope (authoritative)

See [`MOBILE_PHASE_M1_PLAN.md`](MOBILE_PHASE_M1_PLAN.md). In short:

- Expo + React Native + TypeScript foundation
- Environment configuration (dev/UAT/prod API base)
- Shared-style API client (mobile-local first)
- Login (tenant slug + email + password)
- Token storage (SecureStore), refresh single-flight, logout
- Current-user profile (`/auth/me`)
- Permissions + module flags → module-aware navigation shell
- Common loading / error / empty components
- **No** feature screens for ops/HR, **no** push, **no** offline DB

---

## 15. Stop line

This audit intentionally **stops** after documentation. Implementation begins only under Phase M1 authorization.
