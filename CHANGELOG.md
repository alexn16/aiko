# Changelog

## [0.3.0] - 2026-06-07

### Added

- **Project Brain memory documents.** Each project now has an owner-editable brain document with: one-liner, positioning, target audience, problem, solution, key features, differentiators, tone of voice, proof points, forbidden claims, current goal, and preferred channels. Stored in `project_brain_documents`.
- **Project Brain editor** at `/projects/[id]/brain` — minimalist form with completeness score (0-100%), all fields editable, "Generate from context" auto-seeding from existing project data, and a prompt preview.
- **Project Brain completeness on `/home`** — shows "Project Brain: X% complete" with an "Edit Brain" link for the active project.
- **Project Brain prompt injection for AI Skills** — `formatProjectBrainForPrompt` is prepended to every content and research skill prompt when a project brain exists with content.
- **AÏKO seeded Project Brain** — the AÏKO project itself has a complete (100%) brain document seeded via `scripts/seed-aiko-brain.mjs`.
- **Forbidden claims** — each brain includes a `forbidden_claims` list injected into prompts so the AI does not overstate product capabilities.
- **`/api/projects/[id]/brain`** — GET to retrieve brain and completeness; PUT to update, generate from context, or preview prompt.

### Changed

- AI Content Skills (LinkedIn post, Reddit post, email draft, content creation) now use rich project memory. Outputs are project-specific, not generic.
- AI Research/Strategy Skills (7-day plan, next step, report) now use rich project memory.
- AÏKO outputs for its own project describe it correctly as a "local AI Marketing Operating System" with CEO, Kevin, Normal Chrome, and approval-first safety — not as a generic writing tool.
- Normal Chrome mode (`WEB_OPERATOR_BROWSER_MODE=system_chrome`) no longer passes `--no-sandbox` by default. Unsafe flags require `WEB_OPERATOR_CHROME_ALLOW_UNSAFE_FLAGS=true`.

### Safety

- Project Brain does not auto-populate from web-scraped data. All content is owner-provided or generated from existing project records.
- Forbidden claims are injected into every AI Skill prompt to prevent false capability statements.
- No auto-send, post, publish, or message was added.
- Login, CAPTCHA, QR, and security checkpoints still require human completion.
- Approval is still separate from execution.
- Browser safety rules unchanged.

## [0.2.2] - 2026-06-07

### Fixed

- Daily brief now returns actionable, project-aware priorities. `today_summary` shows the specific first waiting operator message or first blocked task (with project name), not a generic count.
- Daily brief greeting changed from time-of-day text ("Good evening") to "Today".
- Daily brief task titles now use `normalizeTaskTitle` — raw "Item approved: Web Operator: ..." titles no longer appear.
- Compound prefix stripping fixed: "Item approved: Web Operator: Kevin, ..." now fully normalises to "Kevin, ..." (the normalizer loops until stable, handling stacked prefixes).
- Project names embedded anywhere in a CEO command are now resolved correctly. "Write an email to introduce ALB Parking..." → project = ALB Parking (not last-used project). The resolver scans all active project names for the longest case-insensitive substring match.
- Stale browser blockers can be cleared from `/home` without executing or completing any action. `clear_stale_blocker` resets the operator to idle.
- `/home` attention states now surface stale blockers separately from fresh ones. Fresh waiting states still show "Kevin needs your help in Chrome."

### Safety

- Clearing stale blockers does not execute actions.
- Clearing stale blockers does not mark actions as completed.
- Project resolution never silently picks the wrong project when a project name is explicitly mentioned.
- Web Operator safety rules unchanged.

## [0.2.1] - 2026-06-07

### Fixed

- Intensive Work reliability guards: `markWorkItem` and `enqueueWorkItem` throw clear errors on missing DB rows instead of silently producing corrupt state. `createAssignedAgentTask` guards against missing INSERT RETURNING rows.
- Provider runtime health checks: `checkAssignedBrainHealth` detects whether the configured brain binary/endpoint is actually reachable at runtime (not just marked "connected" in DB). Raw `spawn codex ENOENT` errors no longer reach the owner UI.
- Manual unblock/resume state: "continue" and "resume" only route to browser-resume flow when browser work is actually waiting. "Agents are paused" no longer surfaces as the owner-facing message for waiting browser state.
- Normal Chrome Web Operator runtime: `system_chrome` mode opens installed Google Chrome via `launchPersistentContext`. Profile lock errors return owner-friendly copy.
- CEO command 503 errors: `spawn codex ENOENT` and similar provider errors return owner-friendly 503 with instructions instead of generic 500 "Internal error".
- Home page error surfacing: API error responses are now shown to the owner when the CEO command returns a non-OK response.
- Owner-facing task title cleanup: Task titles strip raw prefixes (`Blocked:`, `Search:`, `Item approved:`, `Web Operator:`), map raw prompts to clean action titles (e.g. "Plan the next 7 days..." → "Create 7-day marketing plan"), and cap at 70 characters.
- Internal Web Operator sub-tasks hidden from default `/tasks` view. Pass `?include_internal=true` to show all.
- Resume loop per-operator error handling: one failing operator no longer stops the rest of the loop.
- `recoverSession` always uses isolated Playwright Chromium, never system Chrome.

### Changed

- Web Operator supports Normal Chrome via `WEB_OPERATOR_BROWSER_MODE=system_chrome`. Existing logins in a dedicated Chrome profile are reused by Kevin.
- `/connect-ai` shows a Browser Mode card: current mode, Chrome found/not found, profile, collapsible 4-step setup guide, profile-lock warning.
- `/operators` shows browser mode (Normal Chrome / AÏKO profile / Isolated) per card and Chrome-specific waiting-reason copy.
- `/home` attention states now distinguish: manual help in Chrome, ready-to-resume, approval needed, missing capability, Chrome profile locked, intensive work paused.
- Task source labels simplified: `ai_skill` → "AI plan", `strategy_execution_planner` → "Strategy plan", `intensive_work` → "Work cycle", Web Operator roles → "Web research".
- Intensive Work cycle checks brain runtime health before running. Stops cleanly with owner message if brain binary unavailable.

### Safety

- `npm test` and `npm run build` never open a browser (`assertNotTest` guard in controller).
- No auto-send, auto-post, auto-publish, or auto-message was added.
- Login, CAPTCHA, QR, and security checkpoints still require human completion.
- Approval is still separate from execution.
- Missing capabilities are never silently marked available.
- No secrets, tokens, API keys, or filesystem paths in health/browser-setup API responses.

## [0.2.0] - 2026-06-06

### Added

- Simple `/home` command center for owner-friendly daily operation.
- Daily Brief / Today view with priority attention items, next tasks, approvals, waiting operators, and recent outputs.
- Brain Orchestrator for classifying natural owner commands and choosing the right internal flow.
- Project Autopilot marketing research flow for commands like "Promote AÏKO" and "Start marketing for ALB Parking".
- AI Content Skills for internal draft generation without Web Operator actions.
- AI Research and Strategy Skills for plans, personas, campaign briefs, risks, and next-step recommendations.
- Simple task management with `/tasks`, project task visibility, and internal-only task status updates.
- Simplified approval and manual takeover UX.
- Simplified grouped navigation with advanced pages collapsed by default.

### Changed

- Root now opens `/home` after setup.
- `/dashboard` is now the advanced owner overview.
- Technical details are hidden behind Advanced by default.
- AI thinking tasks avoid Web Operator unless live web work is needed.

### Safety

- No auto-send, auto-post, or auto-publish behavior was added.
- Manual takeover for login, CAPTCHA, QR, and security checkpoints is preserved.
- Approval is still separate from execution.
- Forbidden actions remain blocked.

## v0.1.0 - Local MVP

### Added

- AÏKO CEO Chat for project creation, project recall, strategy discussion, executive reporting, and safe delegation.
- Local/private MVP dashboard with CEO brain status, setup status, operating mode, warnings, project/operator/approval counts, recent activity, and quick links.
- First-run setup and provider connection UI with distinct paths for ChatGPT / Codex Local, ChatGPT / Codex OAuth App, OpenAI API Key, Anthropic API Key, Claude options, Ollama, and compatible providers.
- ChatGPT / Codex Local auth path using local Codex CLI/app auth after safe detection, import, and a real test call.
- Project workspace, campaign launch flow, strategy briefs, decision log, generated files, executive reports, and project bundles.
- Web Operator runtime using Playwright, with Skills, Playbooks, action step tracking, screenshots, current URL/title state, and manual takeover controls.
- Strategy Execution Planner that turns a strategy into internal execution plans, required agents, required skills/playbooks, approval gates, internal tasks, and missing capability proposals.
- Controlled self-improvement lifecycle with System Improvement Proposals, Codex-ready implementation prompts, approval/rejection, implementation metadata, validation guards, and timeline.
- Branding assets, owner operating manual, MVP demo script, release checklist, release notes, demo command checklist, health endpoint, setup check, and doctor command.

### Verified

- ChatGPT / Codex Local is supported and verified as the CEO brain through a real Codex Local test call.
- `/dashboard` shows ChatGPT / Codex Local when assigned and does not fall back to Ollama unless selected.
- `/connect-ai` separates ChatGPT / Codex Local, ChatGPT / Codex OAuth App, and OpenAI API Key.
- CEO Chat works with Codex Local for natural responses, project creation, project recall, and read-only self-improvement status.
- Ollama local is supported as a local provider when reachable.
- OpenAI API and Anthropic API are available as API-key profiles when configured.
- Web Operators run through Playwright and have been validated in headed browser mode.
- Login, CAPTCHA, QR, and security checkpoint handling pauses for manual takeover.
- Approval Center separates approval from execution.
- Health/setup/doctor checks return safe status without secrets.
- Test suite and production build pass for this release.

### Safety Guarantees

- AÏKO does not bypass login, CAPTCHA, QR, or security checks.
- AÏKO does not send, post, publish, message, download, share, join groups, or execute similar risky external actions automatically.
- Manual takeover is required for login, CAPTCHA, QR, and security checkpoint flows.
- Approval is not execution: approved risky actions still require explicit resume/execution.
- Web Operator screenshots and logs are handled conservatively around sensitive sessions.
- Missing capabilities create proposals and implementation prompts; AÏKO does not silently rewrite its own code or auto-enable new capabilities.
- Provider tokens, API keys, raw auth files, and local secret paths are not exposed in UI, diagnostics, health checks, or setup checks.

### Known Limitations

- AÏKO v0.1.0 is a local/private MVP, not a finished hosted multi-tenant SaaS product.
- Hosted/team deployment requires the hosted-mode checklist, production auth policy, storage policy, backups, and access-control review.
- Some provider catalog entries are planned or configuration-only until a working adapter and credentials are available.
- Native platform capabilities such as WhatsApp, Meta Business Suite, LinkedIn APIs, Gmail APIs, and CRM integrations are not included by default.
- Unknown or complex websites may require manual supervision and may stop at login/security checkpoints.
- Web Operator Playbooks expose safe workflow plans and step state, but selector-level automation remains intentionally conservative.
- Background scheduled legacy agents may require provider-role cleanup in existing local databases if old API-key fallback configs remain.

### Provider Status

- ChatGPT / Codex Local: supported and verified when Codex CLI/app auth exists locally, import succeeds, and a real test call passes.
- ChatGPT / Codex OAuth App: available only when `OPENAI_OAUTH_*` environment variables are configured and OAuth succeeds.
- OpenAI API Key: available as an OpenAI Platform API-key profile; this is separate from ChatGPT subscription auth.
- Ollama: supported as a local provider when `OLLAMA_BASE_URL` is reachable.
- Anthropic API: available as an API-key profile when configured.
- Claude: available only through Anthropic API, Claude Code local auth, or Claude OAuth when configured and tested.
- Web Operators: require Playwright and an installed browser runtime.
