# AÏKO Cleanup Backlog

**Date:** 2026-06-03
**Purpose:** Track static QA findings that are not immediate blockers but should be cleaned up after local runtime is verified.

| Item | Status | Risk | Recommended cleanup | Priority |
|---|---|---|---|---|
| Legacy `approvals` table and `/api/approvals*` routes | Legacy compatibility | Confusion with active `approval_items`; risk of UI/API drift. | Keep redirect/compat until no users depend on it, then migrate/delete legacy table/routes. | High after runtime verification |
| Legacy `model_configs` and `/api/model-configs` | Legacy fallback | Users may configure old path instead of auth profiles. | Hide/deprecate UI access; keep router fallback temporarily; remove after all profiles migrated. | High |
| `/api/providers/brain` vs `/api/providers/roles` duplicate role assignment APIs | Duplicate path | Divergent assignment behavior; one bug fixed in brain route this pass. | Consolidate to one assignment API and make the other an alias. | Medium |
| Old provider OAuth aliases | Legacy compatibility | Route naming confusion between `/api/providers/oauth/chatgpt/*` and `/api/auth-profiles/openai-codex/*`. | Keep aliases documented; eventually redirect old routes to auth-profile routes only. | Medium |
| Hidden/debug tool routes (`/api/tools/*`, `/api/browser/run`, `/tools`, `/tool-runs`) | Deprecated hidden/debug | Could bypass Web Operator Skills if re-exposed or used casually. | Gate behind debug flag or remove after Web Operator replaces them. | High for production hardening |
| `tool_connections` / `tool_runs` | Legacy/debug data path | Duplicate external-action tracking path. | Mark read-only/debug or migrate into Web Operator action trail. | Medium |
| Legacy jobs routes/tables | Cleanup later | Adds maintenance surface; may confuse active agent task system. | Document as legacy or migrate jobs to agent tasks. | Low |
| SMTP/settings and direct outreach send routes | Safety review item | Any direct send path could conflict with browser-only approval model. | Confirm disabled/approval-gated in production; prefer Web Operator Gmail workflow. | High |
| `callLLM` in older agent modules | Legacy/dead code | Could bypass auth-profile role routing if reactivated. | Replace with `callAI(role)` or mark modules unreachable/deprecated. | Medium |
| `/approval` redirect | Legacy compatibility | Route naming confusion. | Keep redirect for now; remove old links; document `/approvals` as canonical. | Low |
| Migration numbering duplicate (`025_execution_trail.sql`, `025_provider_catalog.sql`) | Operational cleanup | Confusing migration ordering. | Leave filenames stable; document ordering in deployment notes. | Low |
| `/operator` vs `/operators` | Naming cleanup | User confusion between control room and fleet/detail. | Add docs or rename only after product decision. | Low |
| Generated file/screenshot storage | Runtime verification pending | Path permissions/path traversal issues can only be fully verified at runtime. | Add integration checks after dependencies install. | High before deploy |
| Playwright/browser runtime install | Runtime dependency | Web Operator will fail without browsers even if app builds. | Add deploy script/check for Playwright browser installation. | High |
| Optional vs required auth deployment policy | Configuration decision | Hosted deploy may unintentionally expose setup/dashboard if optional mode used. | Explicitly set `AIKO_AUTH_MODE` per deployment and verify middleware. | High |
