# Route lifecycle

## States

```
DRAFT (Under Development)
  → validate → certify → ACTIVE (Certified)
  → close → ARCHIVED (Closed)

ACTIVE
  → revise → new DRAFT (V+1)
  → (when V+1 certified) prior ACTIVE → SUPERSEDED
  → close → ARCHIVED
```

## Actions by state

| Action | DRAFT | ACTIVE | ARCHIVED |
|--------|-------|--------|----------|
| Edit header / ops | Yes | No | No |
| Validate | Yes | No | No |
| Certify | Yes (after validate) | — | — |
| Create New Version | — | Yes | No* |
| Close | Yes* | Yes | — |
| Compare / Where Used | Yes | Yes | Yes |

\*Close from DRAFT only when policy allows; profiles referencing an ACTIVE version block close until reassigned.

## Endpoints

- `POST /routing-versions/:id/validate`
- `POST /routing-versions/:id/certify` (also `/activate`)
- `POST /routing-versions/:id/revise` body `{ revisionNotes }`
- `POST /routing-versions/:id/close` body `{ reason }`
- `GET /routing-versions/:id/where-used`
