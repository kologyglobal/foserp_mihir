# Mobile Security Requirements

> Phase M0 recommendations. **Not implemented** in this phase.  
> Date: **2026-08-03**  
> Applies to future Expo / React Native FOS mobile clients using existing FOS APIs.

---

## 1. Principles

1. Mobile is a **first-class Bearer API client** — not a trusted device. Backend authorization remains the source of truth.
2. **No secrets in the bundle** except public config (API base URL scheme, optional default tenant for demo builds). Never ship `JWT_*`, DB, SMTP, or cloud provider private keys.
3. **Hide ≠ authorize.** Permissions and module flags drive navigation; servers must 403 unauthorized actions.
4. Prefer **online-first** until offline + idempotency design is explicit per write path.
5. Treat payroll, bank, and statutory data as **high confidentiality** when those modules exist.

---

## 2. Authentication & session

| Requirement | Detail | Priority |
|-------------|--------|----------|
| Access + refresh tokens | Use existing login/refresh responses; store both on device securely | P0 (M1) |
| Secure token storage | **iOS Keychain / Android Keystore** via Expo SecureStore (or equivalent encrypted storage). **Never** AsyncStorage plaintext for refresh tokens | P0 (M1) |
| Authorization header | `Authorization: Bearer <accessToken>` on all protected routes | P0 |
| Refresh single-flight | One in-progress refresh; queue failed-401 retries; handle rotated RT (old RT invalid after rotation) | P0 |
| Logout | Call `POST /auth/logout` with refresh token when online; always wipe local tokens | P0 |
| Logout all sessions | Use logout without RT (all user RTs) or admin session revoke for lost-device procedures | P1 |
| Session timeout UX | Honor access TTL (~15m default); proactive refresh with skew; on permanent failure force re-login | P0 |
| Disabled / blocked user | Expect 401/403 on protected APIs; clear session; show account inactive copy | P0 |
| Tenant binding | Login requires `tenantSlug`; never switch tenant by editing URL alone without re-auth | P0 |
| Password change | Supported on web already; mobile later — must clear stored tokens after change | P2 |
| Biometric app unlock | Optional lock screen over already-authenticated session (**not** password replacement). Defer past M1 | P3 |
| Device metadata | Optional: store `userAgent` / app version on refresh token rows (backend already has userAgent/IP fields) | P2 |

### Backend hardening (recommended)

| Change | Why |
|--------|-----|
| Re-validate user + tenant `ACTIVE` during **refresh** | Prevents edge-case access extension if RT revoke is missed |
| Rate-limit refresh lightly in production | Refresh currently skips auth rate limiter |
| Refresh token reuse detection (family invalidation) | Stolen RT detection — later |

---

## 3. Transport & environment

| Requirement | Detail |
|-------------|--------|
| Production HTTPS only | Cleartext HTTP allowed only for local/LAN development builds |
| Certificate pinning | Optional later for high-risk tenants; not M1 |
| API base URL | Build flavors: `development`, `uat`, `production` |
| CORS | Not a substitute for auth; native apps usually omit Origin. Restrict SPA origins still. |
| Debug builds | Disable verbose auth logging in release; no token dumps |

---

## 4. Token storage do / don't

| Do | Don't |
|----|-------|
| SecureStore with appropriate access control | Put RT in AsyncStorage, SQLite unencrypted, logs, analytics |
| Wipe storage on logout / reinstall expectation documented | Keep RT after password change failure |
| Re-auth after long background if policy requires | Cache permanent password for auto-login without user consent policy |

---

## 5. Sensitive data classes

| Class | Examples | Mobile rules (when features ship) |
|-------|----------|-----------------------------------|
| **Auth** | tokens, password fields | Never log; never share sheet export of session JSON |
| **PII** | name, phone, email, address | Minimize list payloads; mask in logs |
| **Payroll** | payslips, net pay, tax | Separate screens; optional screenshot detection/block where OS allows; short cache TTL |
| **Bank / statutory** | account numbers, PAN, UAN | Mask display (last 4); no client-side “download all employees” |
| **Attachments** | personal ID scans | Private cache dir; purge on logout; authed download only |

**Today:** full payslip/bank employee self-serve APIs do **not** exist — requirements ready for when HR ships.

---

## 6. File cache & media

| Requirement | Detail |
|-------------|--------|
| Auth’d download only | No permanent signed public URLs today — use authenticated GET streams |
| Cache location | App sandbox only; mark files no-backup where platform supports |
| Logout | Delete downloaded confidential files (payslips, ID photos) |
| Camera captures | Draft files wiped after successful upload or user discard |
| MIME / size | Client-side validation is UX only; server enforces limits |

---

## 7. Lost / stolen device

| Control | Implementation |
|---------|----------------|
| User | Change password (revokes all RTs) + logout-all if available |
| Admin | Deactivate user or revoke sessions via security admin (`…/security/sessions`) |
| App | Distant wipe via MDM later (out of product scope for M1) |
| OS | Device passcode + optional biometric app lock |

---

## 8. Client identification (non-auth)

Recommended optional headers for later observability / allowlists:

```http
X-Client: fos-mobile/1.0.0
X-Client-Platform: ios|android
X-App-Build: <buildNumber>
```

Do **not** treat these as security credentials.

---

## 9. Logging & crash reporting

| Requirement | Detail |
|-------------|--------|
| Scrub tokens | Strip Authorization, refreshToken, password fields from SDK logs |
| Scrub PII | Avoid full emails/phones in breadcrumbs in prod |
| Errors | Use API error `code` + safe message; never dump full user object |
| Dev tools | Flip off remote logging of request bodies in release |

---

## 10. Screenshots, screen recording, sharing

| Feature area | Guidance |
|--------------|----------|
| Ops (QC, store, maintenance) | Usually allowed |
| Approvals with commercial amounts | Prefer normal OS controls; avoid unnecessary full-screen amount screenshots in UX copy |
| Payslips / bank (future) | FLAG-RESTRICTED: use OS FLAG_SECURE where product policy requires |

---

## 11. Multi-tenant isolation

| Risk | Mitigation |
|------|------------|
| Wrong tenant after reinstall | Always collect tenantSlug on login |
| URL path forging | Backend JWT × route tenant match |
| Super-admin tenant switch (`x-tenant-id`) | Not for field-user mobile build; disable experimental super-admin UX in employee builds |

---

## 12. Frontend patterns that must not copy into mobile

| Web pattern | Risk if copied |
|-------------|----------------|
| `localStorage` `fos-erp-auth` | Extractable tokens on compromised device / shared browser |
| Demo mode (`VITE_USE_API=false`) | Fake permissions / non-authoritative data |
| UI-only `mobilePermissions` matrix without API | False sense of security |
| Base64 files logged to console | PII leakage |
| Storing bank data in Zustand forever | Memory dump exposure |

---

## 13. Production checklist (pre app-store)

- [ ] HTTPS-only prod API base
- [ ] SecureStore verified on iOS + Android
- [ ] Refresh rotation concurrency tested (2 concurrent 401s)
- [ ] Logout + reinstall clears session
- [ ] Disabled user cannot keep calling APIs after admin revoke
- [ ] Release build: no dev login-directory usage
- [ ] Crash reporter redaction rules enabled
- [ ] Privacy policy / data retention reviewed for attachments

---

## 14. Out of scope for M1

- Biometric enrollment as primary MFA
- Certificate pinning
- MDM remote wipe
- Full offline encrypted DB (SQLCipher)
- Push notification cryptography
- Payroll redaction UI

These remain documented requirements for later phases.
