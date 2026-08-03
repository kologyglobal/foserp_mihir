# Mobile Architecture (M1)

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | React Native + Expo SDK 52 |
| Navigation | Expo Router (file-based) |
| Server state | TanStack Query |
| Client/session state | Zustand |
| Forms | React Hook Form + Zod |
| HTTP | Axios (single client) |
| Secrets on device | Expo SecureStore |
| Gestures / animation | RNGH + Reanimated |

## Folder structure

```text
mobile/
  app/                    # Expo Router screens
    (auth)/login
    (app)/(tabs)/…        # Home, Tasks, Approvals, Notifications, More
    (app)/profile|settings
  src/
    api/                  # Axios client, auth API, errors
    auth/                 # SecureStore, session service, permissions, modules
    components/           # Design system
    config/               # env
    hooks/
    providers/
    services/             # Media stubs (later)
    store/                # Zustand stores
    theme/
    types/
    utils/
  assets/
  scripts/
```

## API architecture

```text
Screen / Query
    → apiClient.get|post|put|patch|delete
        → attach Bearer + X-Client headers
        → proactive refresh (skew) / 401 single-flight refresh
        → /api/v1/...
    → ApiError kind mapping (offline, 401, 403, 404, 422, 500)
```

Tenant-scoped resources:

```ts
tenantPath('/modules') → /t/{tenantSlug}/modules
```

Auth endpoints stay global under `/auth/*`.

## Navigation architecture

```text
Root Stack
  index → restore → auth | app
  (auth)/login
  (app)
    (tabs) bottom nav — product shell only
    profile (stack)
    settings (stack)
```

Module feature navigators are intentionally **not** registered in M1.

## Permissions & modules

- `can('crm.lead.view')` reads permission strings from `/auth/me` (and login).
- Navigation hide is UX only — backend still enforces.
- Module flags from `GET /t/:slug/modules` (`isEnabled`, fail-open missing rows, matches backend).

## Security boundaries

- No dual-mode demo store as authority.
- No AsyncStorage tokens.
- Production requires HTTPS base URL.
- Ready for biometric unlock (flag key reserved) without implementing it.

## Performance notes

- Query client default `staleTime` 30s; me query 60s when used.
- Lazy route groups via Expo Router.
- Minimal home data (session already hydrated).
