# AÏKO Minimalist UI Audit

Date: 2026-06-06

Scope: `/home`, `/dashboard`, `/ceo`, `/today`, `/tasks`, `/operators`, `/operators/[id]`, `/approvals`, `/connect-ai`, `/setup`, `/system`, `/skills`, `/work`.

## Direction

Default screens should feel like a calm AI operating system command center. Technical state, raw payloads, IDs, logs, diagnostics, and long policy copy should remain available behind Advanced, not visible by default.

## Page Notes

### `/home`
- Too busy: Today, command, project picker, quick actions, task list, recent output, intensive work, attention card, live work, and advanced diagnostics were all competing.
- Changed: first screen now centers on one command box, a short context row, and three main cards: Today, Current Work, Next Tasks.
- Moved to Advanced: project picker, quick actions, intensive work controls, attention diagnostics, operator/action JSON.
- Main action: Start.

### `/dashboard`
- Still useful as the advanced owner overview, but it should not be the first owner surface.
- Keep as Advanced dashboard. Avoid adding more cards unless they answer a release/ops question.

### `/ceo`
- Too busy: long welcome copy, many suggestion chips, visible action tags under messages, dense side panel.
- Changed: welcome copy and suggestions shortened. Action metadata is now hidden under Actions.
- Still to improve later: side panel could become a collapsible context drawer.

### `/today`
- Already close to the desired direction.
- Keep summary, priorities, and next action. Avoid counters unless they become actionable.

### `/tasks`
- Too busy: project/owner/status filters were primary; rows included source and age metadata.
- Changed: simple Todo / Working / Blocked / Done tabs first. Filters and metadata moved to Details.
- Main action: Done or Reopen.

### `/operators`
- Too busy: role badges, current URL, timestamps, project assignment, stop controls, and action links were visible on each card.
- Changed: cards show name, status, current work, and one Open button. Management controls moved to Advanced.
- Main action: Open.

### `/operators/[id]`
- Existing top state is acceptable: Kevin, status, current website, screenshot, Resume/Open browser.
- Keep playbook/action logs behind Advanced. Avoid surfacing action IDs or skill IDs by default.

### `/approvals`
- Too busy: all approval states and tabs were visible by default.
- Changed: pending approvals are the default. History/status filters moved behind Advanced.
- Main action: Approve or Reject.

### `/connect-ai`
- Too busy: provider profiles, env vars, OAuth requirements, and diagnostics appeared immediately.
- Changed: current brain first, then three simple paths: ChatGPT / Codex Local, Ollama Local, API Key.
- Moved to Advanced: saved profiles, OAuth app setup, diagnostics, missing env var details.
- Main action: connect/test/assign one real provider.

### `/setup`
- Still has more explanatory copy than ideal.
- Future small pass: keep first-run provider choice short and move provider honesty details to Advanced.

### `/system`
- Dense by nature because it is a control surface.
- Keep grouped lifecycle and timeline, but make proposal cards summary-first.

### `/skills`
- Keep three groups. Avoid long per-skill schemas in default view.

### `/work`
- Keep queue visible for power users. Home should only show current work summary.

## Shared UI Primitives Added

- `PageShell`
- `MinimalCard`
- `PrimaryAction`
- `StatusPill`
- `EmptyState`
- `AdvancedDisclosure`

## Safety Copy

Short visible copy remains:

> AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without you.

## Remaining Polish

- Convert `/setup`, `/system`, `/skills`, and `/work` to the new primitives in a later style-only pass.
- Consider making CEO side context a collapsible drawer.
- Reduce nested bordered sections in project workspace without changing behavior.
