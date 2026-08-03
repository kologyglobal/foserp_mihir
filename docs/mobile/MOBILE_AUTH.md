# Mobile Authentication (M1)

## Flow

```text
App launch
  → load SecureStore session
  → if tokens present: GET /auth/me + GET /t/:slug/modules
  → signed_in | clear + login

Login
  → POST /auth/login { tenantSlug, email, password }
  → store access + refresh in SecureStore
  → optional remember prefs (slug + email only — never password)
  → hydrate me + modules

API calls
  → Authorization: Bearer <access>
  → if near expiry: POST /auth/refresh-token { refreshToken } (single-flight, rotation)
  → on 401: refresh once and retry
  → on failure: clear tokens + “Session expired”

Logout
  → POST /auth/logout { refreshToken } (best-effort)
  → clear tokens + query cache
  → keep remember prefs if enabled
```

## Secure storage keys

| Key | Contents |
|-----|----------|
| `fos_mobile_session_v1` | accessToken, refreshToken, expiry, tenantId, tenantSlug |
| `fos_mobile_remember_v1` | tenantSlug, email, rememberLogin (no secrets) |
| `fos_mobile_biometric_ready_v1` | future biometric gate preference |

## Multi-tenant

- Login always requires **tenantSlug** (organisation code).
- JWT embeds `tenantId`; paths use `/t/:tenantSlug/…`.
- Tenant switch in M1 = logout + re-login with new slug (no passwordless switch).

## Disabled / inactive users

- Login rejects inactive paths via API.
- Hydrate after login/restore checks `user.status === 'ACTIVE'`.
- Friendly copy for blocked/inactive/lock/rate-limit.

## Environment

See `mobile/.env.example`:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_APP_ENV` = development | uat | production
- `EXPO_PUBLIC_APP_VERSION`, `EXPO_PUBLIC_BUILD_NUMBER`
- `EXPO_PUBLIC_DEFAULT_TENANT_SLUG` (UI prefill only)

## Soft backend gap (unchanged)

Refresh endpoint does not re-query user ACTIVE (M0). Prefer server patch before wide beta.
