# FOS ERP Mobile

Native mobile client (Expo + React Native) for FOS ERP. Phase **M1** foundation — authentication, secure session, home/profile/settings shell. Feature modules (CRM, manufacturing, etc.) are **not** in M1.

## Prerequisites

- Node.js 20+
- Expo Go or iOS Simulator / Android emulator
- Running FOS backend reachable from the device

## Setup

```bash
cd mobile
cp .env.example .env
# Edit EXPO_PUBLIC_API_BASE_URL — use LAN IP on physical devices
npm install
node scripts/generate-placeholder-assets.cjs
npx expo start
```

### API URL tips

| Client | Typical URL |
|--------|-------------|
| iOS Simulator | `http://127.0.0.1:5000/api/v1` |
| Android emulator | `http://10.0.2.2:5000/api/v1` |
| Physical device | `http://<your-lan-ip>:5000/api/v1` |
| UAT / Production | `https://…/api/v1` only |

Production builds **require HTTPS** (`assertApiConfigured`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run typecheck` | TypeScript |
| `npm run test:unit` | Structural M1 checks |

## Documentation

- `docs/mobile/MOBILE_PHASE_M1.md`
- `docs/mobile/MOBILE_ARCHITECTURE.md`
- `docs/mobile/MOBILE_AUTH.md`
- `docs/mobile/MOBILE_DESIGN_SYSTEM.md`

## Security

- Tokens: **Expo SecureStore only** (never AsyncStorage)
- No JWT secrets or DB credentials in the app bundle
- Logout clears tokens and React Query cache
