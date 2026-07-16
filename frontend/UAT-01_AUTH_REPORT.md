# UAT-01 — Authentication & Access

**Date:** 2026-07-11
**Overall:** ✅ PASS (24/24)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-01.1 | Login/logout | Public /login route registered | PASS |  |
| UAT-01.2 | Protected-route access | ApiAuthGate wraps authenticated layout | PASS |  |
| UAT-01.3 | Protected-route access | ApiAuthGate bypasses when not API mode | PASS |  |
| UAT-01.4 | Protected-route access | Unauthenticated users redirected to /login | PASS |  |
| UAT-01.5 | Protected-route access | ProtectedOutlet guards page content | PASS |  |
| UAT-01.6 | Login/logout | AuthProvider wraps application | PASS |  |
| UAT-01.7 | Login/logout | Login page supports sign-in + forgot + reset views | PASS |  |
| UAT-01.8 | Login/logout | Logout API wired in AuthProvider | PASS |  |
| UAT-01.9 | Session persistence | Session round-trips via localStorage | PASS |  |
| UAT-01.10 | Session persistence | Remember-me key defined on login page | PASS |  |
| UAT-01.11 | Session persistence | syncSessionUserFromAuth maps API user to session | PASS |  |
| UAT-01.12 | Login/logout | Logout clears stored session | PASS |  |
| UAT-01.13 | Invalid credentials | Login rejects bad credentials with message | PASS |  |
| UAT-01.14 | Role/permission | Sales Manager can access /crm | PASS |  |
| UAT-01.15 | Role/permission | Sales Manager can access /crm/leads | PASS |  |
| UAT-01.16 | Direct URL without permission | Shop Floor blocked from /crm (direct URL) | PASS |  |
| UAT-01.17 | Direct URL without permission | Shop Floor blocked from /settings/roles | PASS |  |
| UAT-01.18 | Role/permission | Shop Floor can access /shop-floor | PASS |  |
| UAT-01.19 | Role/permission | Admin can access /crm and /settings | PASS |  |
| UAT-01.20 | Direct URL without permission | AccessDeniedPage shows role + required permission | PASS |  |
| UAT-01.21 | Invalid credentials | Live API rejects invalid login | PASS | HTTP 401 |
| UAT-01.22 | Login/logout | Live API login returns tokens | PASS | Login successful |
| UAT-01.23 | Session persistence | Live /auth/me validates access token | PASS | admin@vasant-trailers.com |
| UAT-01.24 | Login/logout | Live logout endpoint accepts request | PASS | 204/200 |

## Manual sign-off checklist

- [ ] Open `/login` — split layout, demo credentials button works
- [ ] Sign in with `admin@vasant-trailers.com` / `Admin@123` (API mode)
- [ ] Refresh browser — session persists, lands on CRM/home without re-login
- [ ] Sign out — returns to login, `/crm` redirects to login when unauthenticated
- [ ] Wrong password shows clear error (not "Failed to fetch")
- [ ] Shop-floor role user: `/crm` shows Access Denied (demo mode role switch)
- [ ] Sales manager: `/crm` loads dashboard

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`
