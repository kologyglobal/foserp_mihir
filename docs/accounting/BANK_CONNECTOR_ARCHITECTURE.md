# Bank Connector Architecture

**Phase:** 5D1–5D4 + **Bank hardening** (distributed sync lease + CAMT.052/.054)  
**Status:** Sandbox FS, allow-listed REST, live SFTP, and **SIMULATED Open Banking AIS** can ingest MT940/CAMT.052/.053/.054 as `BANK_API` statements. Multi-instance sync is guarded by a MySQL lease on `BankConnector`. Live TPP / production bank AIS download remains deferred.

## Purpose

Pull bank statements into the existing import pipeline (MT940 / CAMT family parsers) without inventing balances or inventing “connected” success without a probe.

Manual file upload remains fully supported.

## Distributed sync lease (hardening)

| Layer | Detail |
|-------|--------|
| **Columns** | `BankConnector.syncLockUntil`, `BankConnector.syncLockToken` (IndiaMART pattern; no separate lease table) |
| **TTL** | 10 minutes; expired leases are stealable for crash recovery |
| **Acquire** | Atomic `updateMany` where lock is null/expired; used by **manual and scheduled** sync |
| **Heartbeat** | Extended during multi-file sync; lost ownership aborts before further ingest |
| **Scheduler** | Lease contention counted as `skippedLocked` (not failure); `tickInProgress` remains local only |
| **API** | Manual Sync → `409 BANK_CONNECTOR_SYNC_IN_PROGRESS` + `syncLeaseUntil`; DTO exposes `syncInProgress` / `syncLeaseUntil` (never the token) |

Deployment: migrate schema → deploy all app instances → enable `BANK_CONNECTOR_CRON_ENABLED`.

## What 5D1–5D3 shipped

| Layer | Detail |
|-------|--------|
| **Schema** | `BankConnector` + enums + `BankConnectorConsent` |
| **Sandbox FS** | `mode=SANDBOX` + `sandboxRoot` |
| **REST** | Allow-listed `GENERIC_REST` |
| **Live SFTP** | `MT940_SFTP` / `CAMT_SFTP` with `mode=LIVE` |
| **Consent** | start / callback / revoke; encrypted tokens |
| **Ingest** | Sync → MT940/CAMT → `BankStatement` `sourceType=BANK_API` |
| **Permissions** | `finance.bank_connector.view` \| `manage` \| `sync` |

## What 5D4 ships

| Layer | Detail |
|-------|--------|
| **SIMULATED AIS** | `OPEN_BANKING` with `mode=SIMULATED` (or SANDBOX) pulls from allow-listed sandbox drop folder after consent is **AUTHORIZED** — same precedent as GST NIC `SIMULATED` |
| **Consent gate** | Test-connection and sync require latest consent status `AUTHORIZED` |
| **Cron worker** | `server.ts` starts in-process tick (60s); syncs ENABLED connectors whose `scheduleCron` matches the current minute and have not synced in this minute |
| **Env** | `BANK_CONNECTOR_AIS_PROVIDER` (`SIMULATED` default / `LIVE`), `BANK_CONNECTOR_CRON_ENABLED` |
| **Live TPP** | `mode=LIVE` or AIS provider `LIVE` → `422 BANK_CONNECTOR_NOT_IMPLEMENTED` |

## Provider status

| Provider | 5D4 |
|----------|-----|
| `MANUAL_FILE` | Stub (use file import UI) |
| `GENERIC_REST` | ✅ Sandbox FS **or** allow-listed HTTP |
| `MT940_SFTP` / `CAMT_SFTP` | ✅ Sandbox FS **or** live SFTP |
| `OPEN_BANKING` | ✅ Consent + **SIMULATED AIS**; live TPP AIS ❌ |

## Security rules

1. Never store API keys, passwords, or refresh tokens in `configJson` or logs.  
2. `*EnvKey` fields are only uppercase env **names**.  
3. REST hosts → `BANK_CONNECTOR_ALLOWED_HOSTS`; SFTP hosts → `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS`.  
4. Sandbox roots → `BANK_CONNECTOR_SANDBOX_ROOTS` when that allow-list is set.  
5. Consent tokens require `FIELD_ENCRYPTION_KEY`; API responses expose `hasEncryptedToken` only.  
6. Production: `hostKeyFingerprint` mandatory for live SFTP; disable sandbox unless intentional.  
7. Cron does not invent statements — it only calls the same sync/ingest path as manual Sync.

## Still deferred

1. Real bank AIS statement download / production TPP OAuth  
2. Circuit breaker / rate limits beyond fetch timeout  
3. SSH agent / interactive host-key prompts  

CAMT.052 / .054 and multi-instance cron lock are **shipped** (bank hardening).

## Related docs

- [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md)
- [`BANK_STATEMENT_IMPORT_ARCHITECTURE.md`](BANK_STATEMENT_IMPORT_ARCHITECTURE.md)
