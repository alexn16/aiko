# AÏKO v0.3.0 — Project Brain Release Notes

**Date:** 2026-06-07
**Type:** Project memory / context quality
**From:** v0.2.2

---

## What is Project Brain?

Project Brain is an owner-editable memory document attached to each project. It stores rich context about what the project is, who it serves, and how to talk about it — then automatically injects this context into every AI Skill prompt, CEO chat, and strategy output for that project.

**Fields:**
- **One-liner** — one sentence that describes the project
- **Positioning** — what it does and why it matters
- **Target audience** — who it is for
- **Problem** — what problem it solves
- **Solution** — how it solves it
- **Key features** — list of main capabilities
- **Differentiators** — what makes it unique
- **Tone of voice** — how to write about it
- **Proof points** — evidence statements
- **Forbidden claims** — what the AI must NOT say
- **Current goal** — what to focus on right now
- **Preferred channels** — where to promote
- **Owner notes** — anything else the AI should know

A completeness score (0–100%) shows how much of the brain is filled in.

---

## Why it matters

Without Project Brain, AÏKO generates generic AI tool copy because it only knows the project name and a short goal. With Project Brain, every output uses the real product context.

### Before (v0.2.x — thin context):

> *"Introducing AIKO: Revolutionizing Content Creation. We're excited to introduce AIKO, your new go-to platform for high-quality content creation!"*

### After (v0.3.0 — Project Brain injected):

> *"Introducing AÏKO: Your Private Marketing Operating System. As a founder, indie hacker, or creator, you know the importance of having control over your marketing strategy. AÏKO provides a command center where CEO Chat plans, AI Skills create drafts, Web Operator Kevin uses Normal Chrome for supervised research, and approval-first safety means nothing sends without you."*

The second draft is usable. The first requires a full rewrite.

---

## How to edit Project Brain

1. Navigate to `/projects` and open your project.
2. Click the **Brain** tab or go to `/projects/[id]/brain`.
3. Fill in the fields. Each field has a placeholder to guide you.
4. Click **Save**.

Or let AÏKO generate a starter:
- Click **Generate from context** to auto-populate from your existing project records (strategy brief, decisions, memory notes).
- Review and edit — generated content is marked as auto-generated.

Click **View prompt context** to preview exactly what AÏKO injects into AI prompts.

---

## How Project Brain affects AI Skills

When you run a CEO Chat command that uses an AI Skill (content creation, strategy, research, LinkedIn post, Reddit post, email draft, 7-day plan, executive report) and a project is selected:

1. AÏKO loads the project brain from `project_brain_documents`.
2. `formatProjectBrainForPrompt` formats it as a concise `=== Project Brain ===` block.
3. This block is prepended to the AI Skill prompt before the project executive summary.
4. The AI generates output that is specific to your project, not generic.

The **forbidden claims** list prevents the AI from making false statements about the project (e.g. "fully autonomous posting" for a product that requires approval).

---

## Seeding the AÏKO project

If you have an AÏKO project in your database, run:

```bash
DATABASE_URL=<your-db-url> node scripts/seed-aiko-brain.mjs
```

This seeds the AÏKO project brain at 100% completeness with accurate product descriptions, differentiators, and forbidden claims.

---

## Known limitations

- **Brain is only as good as what you put in.** If you leave fields blank, the AI falls back to thin project context as before.
- **Generated content from "Generate from context"** uses only what already exists in your project records. If your project is new, the generated brain will be sparse.
- **The AI model may still drift** toward generic copy on short or ambiguous requests. Providing a specific, concrete prompt ("Write a LinkedIn post about AÏKO's approval-first safety model") produces better results than a generic request.
- **Brain is not yet injected into** CEO command agent context or daily brief recommended next action. These are planned for a future update.
- **No version history** for brain documents. The last saved state is the current state.

---

## Safety guarantees (unchanged)

- Project Brain does not fetch or inject web-scraped data.
- Forbidden claims are injected as negative constraints — the AI is instructed what NOT to say.
- No auto-send, post, publish, or message.
- Login, CAPTCHA, and security checkpoints still require human completion.
- Approval is still separate from execution.
- `npm test` and `npm run build` never open a browser.

---

## How to validate

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev

# 1. Seed AÏKO brain (if not already done)
DATABASE_URL=postgresql://alli@localhost:5432/aiko node scripts/seed-aiko-brain.mjs

# 2. Open /projects/[AÏKO_PROJECT_ID]/brain
#    Confirm fields are populated and completeness = 100%

# 3. In CEO Chat:
"Create a LinkedIn post for AÏKO and save it."
# Expect: output mentions Marketing Operating System, Kevin, approval-first safety
# Expect: file saved to /files

# 4. Check /api/health
curl http://localhost:3001/api/health
# Expect: version: 0.3.0

# 5. Run tests
npm test    # 417 pass, 0 fail
npm run build  # clean
```
