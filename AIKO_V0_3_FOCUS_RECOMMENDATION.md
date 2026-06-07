# AÏKO v0.3.0 Focus Recommendation

**Based on:** Real-use session — AÏKO promotion, 2026-06-07
**Recommendation:** Project Memory and Context Quality

---

## Chosen Focus: Project Memory

The single highest-leverage investment for v0.3.0 is giving AÏKO real knowledge about each project it works on.

### The core problem

AÏKO generates LinkedIn posts that call it "a writing assistant." It recommends generic "define target audience" next steps for every project regardless of what that project has already done. When the owner says "promote AÏKO," the AI produces copy that describes a different product entirely.

This happens because the AI only has three thin fields: `name`, `goal`, and `target_market`. It cannot access:
- What the product actually does
- What has already been tried
- What the owner's tone and style is
- Which channels are relevant
- What has worked vs. failed
- Recent decisions and context

Every AI feature — content creation, planning, research, strategy — is limited by this ceiling. Fixing the ceiling fixes everything else downstream.

### Why this is highest leverage

| Feature | Blocked by thin project memory? |
|---|---|
| LinkedIn post quality | ✅ Yes |
| Reddit post quality | ✅ Yes |
| 7-day plan relevance | ✅ Yes |
| Executive report accuracy | ✅ Yes |
| Kevin's research targeting | ✅ Yes |
| "What should I do today?" answer | ✅ Yes |
| Recommended next action in daily brief | ✅ Yes |

Every other improvement (content quality, research quality, autonomous cycles) requires better project context first. It's the multiplier.

---

## What to Build in v0.3.0 (5 concrete tasks)

### 1. Project context document

**Owner-editable rich text document per project.** Stored in `generated_files` with `source_entity_type = 'project_context'`. Contains:
- What this project is (in the owner's words)
- Who it's for
- Key differentiators
- Tone and voice
- Current progress and recent decisions
- What has already been tried
- Channels in use

The AI reads this document at the start of every skill execution for this project. The owner can edit it directly at `/projects/[id]/context`.

**Why this over a DB schema change:** Owner can write free-form prose that the AI actually understands. A structured schema would need mapping to prose anyway.

### 2. Auto-include project context in all AI Skill prompts

When `project_id` is set and a project context document exists, prepend it to every `executeAISkill` prompt as a `<project_context>` block. Max 1500 tokens. Summarise if longer.

This makes every downstream skill (LinkedIn post, 7-day plan, executive report, strategy brief) immediately better without changing any of their logic.

### 3. "What should I do today for [project]?" intent

Add a `project_daily_advice` intent to the orchestrator. When the owner asks "What should I do today for AÏKO?" or "What's the highest priority for AÏKO this week?" — return a project-specific recommendation based on:
- Project context document
- Current tasks (blocked, open)
- Recent files/outputs
- Active proposal blockers
- Last activity date

Not the system daily brief — a project-focused one-paragraph strategic suggestion.

### 4. Save outputs by default; show "previous draft" in response

Two small changes:
1. AI Skill outputs are saved to `/files` by default (not only when "save it" is in the command).
2. When generating content that already has a recent file with the same skill+project, include a `previous_draft_url` in the response and mention it: "You already have a LinkedIn post draft from 2 hours ago. Here's a new version — previous draft is at /files/..."

This eliminates duplicate files and the "must remember to say save it" friction.

### 5. Project context seeding via CEO Chat

Owner can say: "Remember that AÏKO is a local AI Marketing Operating System with a CEO Chat, a Web Operator called Kevin, and Intensive Work cycles." AÏKO stores this in the project context document, appending it if a document already exists.

Command pattern: "Remember that [fact about project X]." or "Note that [project X] [fact]."

---

## What NOT to Build Yet

**Web research quality** — Kevin's skill routing improves automatically once project context tells him what to research. Don't add new Playwright skills before the memory layer exists.

**Autonomous work cycles** — Intensive Work is already built. The cycles are generating generic content because project memory is thin. Fix memory first; the cycles become useful automatically.

**Deployment/hosting** — This is a local MVP. Deploying thin-context AI to a hosted product creates more problems than it solves. Wait for context quality.

**New platform integrations** (CRM, calendar, etc.) — These are missing-capability proposals that require careful scoping. Don't add until the foundation is solid.

**UI redesign** — The minimalist UI pass in v0.2.0 was the right call. Don't touch it again until there's a real UX problem to solve.

---

## Safety Constraints to Preserve

- Project context document is owner-editable, not auto-populated with web-scraped data.
- The AI reads context; it does not publish, send, or act on it without approval.
- "Remember that..." only writes to the local project context, never to external services.
- Kevin still stops at login, CAPTCHA, and security checkpoints regardless of project context.
- Approval is still required for any send/post/publish/message action.
- No auto-send of email or social posts even if the project context contains credentials or draft approval.

---

## Estimated Impact

After v0.3.0:

- LinkedIn/Reddit drafts mention the actual product features — become 80% usable without rewriting.
- "What should I do today for AÏKO?" returns a real next step in 2-3 sentences.
- Executive reports contain relevant product-specific insights.
- Intensive Work generates plans that reference the product's actual strategy.
- The owner spends 30 minutes per week editing context, which unlocks every AI feature.

Without v0.3.0: Every AI output requires heavy editing to be usable. AÏKO saves no time on content; it only provides a safe draft scaffold.

---

## One-line summary

> Give AÏKO a memory. Everything else gets better automatically.
