# Implementation Plan

## Phase 1 — Frontend Audit ✓
- Document modules, routes, types, stores, mock data
- Create API matrix and entity map

## Phase 2 — Backend Foundation
- Express + TypeScript + env validation
- Prisma MySQL schema + migrations
- Error handling, response helpers, security middleware
- Health check + Swagger

## Phase 3 — Multi-Tenant Core
- Tenant model + CRUD APIs
- Request context middleware
- Tenant middleware (ID/slug validation vs JWT)
- Tenant isolation in all repositories

## Phase 4 — Auth & Users
- JWT access + refresh token rotation
- bcrypt passwords
- Users CRUD with multi-role assignment
- Permissions + role middleware
- Audit logs
- Code series service

## Phase 5 — CRM Module
- Companies, contacts, leads, activities
- Pipelines + stages + opportunities
- Lead assign/qualify/disqualify/convert
- Opportunity win/lose
- Frontend-aligned DTO mappers

## Phase 6 — Frontend Integration
- API client with auth + refresh
- Auth context + login page
- Wire CRM stores to API (leads, companies, contacts, opportunities, activities)
- Loading/error states

## Phase 7 — Verification
- Vitest + Supertest
- `npm run typecheck`, `build`, `test`, `db:setup`

## Assumptions

1. MySQL credentials provided via `DB_*` env vars
2. Frontend "Company" maps to `crm_companies` with Customer DTO shape
3. Pipeline stages seeded with slugs matching frontend `OpportunityStage`
4. Lead stages use frontend `LeadStage` enum values (snake_case)
5. Quotations, sales orders, CRM masters deferred to later phases
6. Super Admin is a global role with `tenant.manage` permission
