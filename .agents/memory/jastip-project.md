---
name: Jastip Anggun Jaya project
description: Key decisions and architecture for the JAJ jastip app
---

# Jastip Anggun Jaya Project

**Why:** Avoid confusion between two registered artifacts — only one has real code.

## Active artifact
- **Dir:** `artifacts/jastip/` — this is the real app with all pages, components, API routes
- **Dir:** `artifacts/jastip-app/` — empty scaffold, ignore it
- **Workflow:** `artifacts/jastip: web` — this is the one to restart
- **API:** `artifacts/api-server: API Server` — shared backend

## Auth
- Password hash: `SHA256(password + "jaj_salt_2024")` implemented in `artifacts/api-server/src/routes/auth.ts`
- Demo accounts seeded directly via executeSql (seed script has drizzle-orm resolution issue in scripts package)

## How to apply
- Always restart `artifacts/jastip: web` (not jastip-app) after frontend changes
- To seed accounts again, use executeSql directly, not the tsx seed script
