# Bank Connector Architecture

**Phase:** 5D1 scaffold + 5D2 sandbox/REST + **5D3 live SFTP + Open Banking consent scaffold** (2026-07-21)  
**Status:** Sandbox FS, allow-listed REST, and **live SFTP** can ingest MT940/CAMT as `BANK_API` statements. Open Banking supports **consent lifecycle only** — AIS statement download remains deferred.

## Purpose

Pull bank statements into the existing 5A2 import pipeline (MT940 / CAMT.053 parsers) without inventing balances or inventing “connected” success without a probe.

Manual file upload remains fully supported.

## What 5D1–5D2 shipped

| Layer | Detail |
|-------|--------|
| **Schema** | `BankConnector` + enums |
| **Sandbox FS** | `mode=SANDBOX` + `sandboxRoot` |
| **REST** | Allow-listed `GENERIC_REST`; Bearer via `credentialEnvKey` |
| **Ingest** | Sync → MT940/CAMT → `BankStatement` `sourceType=BANK_API` |
| **Permissions** | `finance.bank_connector.view` \| `manage` \| `sync` |

## What 5D3 ships (this phase)

| Layer | Detail |
|-------|--------|
| **Live SFTP** | `MT940_SFTP` / `CAMT_SFTP` with `mode=LIVE` via `ssh2-sftp-client` |
| **Host allow-list** | `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS` (comma-separated); refuse otherwise |
| **Host key** | `configJson.hostKeyFingerprint` required in production; optional + WARN in non-prod |
| **Credentials** | `usernameEnvKey` + `passwordEnvKey` **or** `privateKeyEnvKey` (+ optional `passphraseEnvKey`) — env refs only |
| **Consent scaffold** | `BankConnectorConsent` + `POST …/consents/start\|callback\|revoke` |
| **Token storage** | AES-256-GCM ciphertext via `FIELD_ENCRYPTION_KEY` only; never returned by API |
| **OPEN_BANKING pull** | `testConnection` / `sync` remain **422 NOT_IMPLEMENTED** until AIS is configured |

## Provider status

| Provider | 5D3 |
|----------|-----|
| `MANUAL_FILE` | Stub (use file import UI) |
| `GENERIC_REST` | ✅ Sandbox FS **or** allow-listed HTTP |
| `MT940_SFTP` / `CAMT_SFTP` | ✅ Sandbox FS **or** live SFTP |
| `OPEN_BANKING` | Consent APIs ✅; AIS statement pull ❌ |

## Security rules

1. Never store API keys, passwords, or refresh tokens in `configJson` or logs.  
2. `*EnvKey` fields are only uppercase env **names**.  
3. REST hosts → `BANK_CONNECTOR_ALLOWED_HOSTS`; SFTP hosts → `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS`.  
4. Sandbox roots → `BANK_CONNECTOR_SANDBOX_ROOTS` when that allow-list is set.  
5. Consent tokens require `FIELD_ENCRYPTION_KEY`; API responses expose `hasEncryptedToken` only.  
6. Production: `hostKeyFingerprint` mandatory for live SFTP; disable sandbox unless intentional.

## Still deferred (5D4+)

1. Real bank AIS statement download / production TPP OAuth  
2. Scheduled cron worker for `scheduleCron`  
3. Circuit breaker / rate limits beyond fetch timeout  
4. CAMT.052 / .054  
5. SSH agent / interactive host-key prompts

## Related docs

- [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md)
- [`BANK_STATEMENT_IMPORT_ARCHITECTURE.md`](BANK_STATEMENT_IMPORT_ARCHITECTURE.md)
