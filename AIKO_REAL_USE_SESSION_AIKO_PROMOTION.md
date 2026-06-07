# AÏKO Real-Use Session: Promoting AÏKO Itself

**Date:** 2026-06-07
**Version:** 0.2.2
**Objective:** Can AÏKO help promote itself faster than doing it manually?

---

## Session Summary

Ran 9 CEO Chat commands on the AÏKO project. All commands ran without crashing. Project resolution worked correctly (AIKO project chosen for all relevant commands). AI Skill outputs saved to /files. No external actions taken without approval. Safety model held throughout.

**Verdict:** AÏKO is functional but not yet genuinely useful for content promotion. The drafts it produces are generic and wrong — not because the AI is bad, but because the project context is too thin for the AI to know what AÏKO actually is.

---

## Command-by-Command Results

| Command | Intent | AÏKO project? | Useful output? |
|---|---|---|---|
| "What should I do today to promote AÏKO?" | daily_brief | ❌ No project | ❌ Got generic daily brief |
| "Plan the next 7 days of marketing work for AÏKO." | marketing_strategy | ✅ | ⚠️ Plan created, not saved to /files |
| "Create a LinkedIn post for AÏKO and save it." | content_creation | ✅ | ❌ Generic "writing assistant" copy |
| "Create a Reddit post for AÏKO and save it." | content_creation | ✅ | ❌ Generic "AI-powered writing tool" copy |
| "Generate an executive report for AÏKO." | executive_report | ✅ | ⚠️ Initiated but output unclear |
| "Start marketing for AÏKO." | project_autopilot_marketing | ✅ | ⚠️ Research intent, no browser result |
| "Kevin, open relevant websites…" | general | ❌ | ❌ Blocked: "AÏKO does not have a skill for 'relevant'" |
| (7-day plan created, tasks from plan?) | — | — | ⚠️ No task creation triggered automatically |
| (project bundle not run — no endpoint) | — | — | — |

---

## What Worked

- **Project resolution** — "for AÏKO", "for AIKO" correctly resolved to the AIKO project in every case. The `resolveProjectFromCommand` fix from v0.2.2 is solid.
- **Safety** — All content marked "Draft created only. Publishing or sending requires approval." No auto-post, no auto-send.
- **File saving** — LinkedIn and Reddit drafts saved to `/files` with clean filenames (`aiko-linkedin-post-draft.md`, `aiko-reddit-post-draft.md`). Discoverable.
- **No crashes** — All 9 commands completed without errors.
- **Skill routing** — "Create a LinkedIn post" → `write_linkedin_post`, "Create a Reddit post" → `write_reddit_post`, "Generate executive report" → `executive_report`. Routing is correct.

---

## What Failed

### 1. Content quality is fundamentally wrong
The LinkedIn draft says AÏKO is "an AI platform for content creation." The Reddit post calls it "an AI-powered writing assistant." Neither mentions:
- Local AI OS
- CEO Chat for project/strategy
- Kevin the Web Operator doing browser research
- Intensive Work cycles
- Normal Chrome
- Marketing-focused workflows

The AI has no idea what AÏKO actually does. It generates generic "AI tool" copy because the project's stored context is thin.

### 2. "What should I do today to promote AÏKO?" → daily_brief (wrong intent)
The daily brief handler hijacked a project-specific question. The response was the system daily brief (operator waiting, blocked tasks) — not AÏKO-promotion advice. There is no "project-specific planning" intent that says "tell me what to do for this specific project today."

### 3. "Kevin, open relevant websites where AÏKO could be promoted"
`delegation.status: blocked` — "I created a System Improvement Proposal in..." because AÏKO parsed "relevant" as a website name, not as an adjective. The command needs to say something like "Kevin, research promotion channels for AÏKO" for the Web Operator skill lookup to work.

### 4. Files saved twice
LinkedIn and Reddit drafts appear twice in `/files` because the same command was run twice during testing. No deduplication exists. A real owner who retries a command generates a new file each time with no indication that a previous draft already exists.

### 5. 7-day plan was not saved to /files
The `create_7_day_plan` skill ran and the response mentioned a plan, but no file was saved (`saved: False`). The owner has to re-run with explicit "save it" or "save as file" to get a saved output.

---

## What Was Confusing

- **"What should I do today to promote AÏKO?"** — reasonable question, wrong intent classification. The owner wants strategic advice, not a system status brief.
- **The plan was in the CEO Chat response but not in /files** — owner has to know to explicitly say "save it."
- **Executive report result was unclear** — the response said it would generate one but no file appeared in /files immediately.
- **Duplicate files** — two LinkedIn drafts, two Reddit drafts. No way to see which is newer or tell them apart by name alone.

---

## What Saved Time

- Zero setup time to generate drafts — one command, file saved, done.
- Project resolution is reliable: "for AÏKO" always picks the right project.
- `/files` is a useful single place to see all drafts.
- The safety copy ("Draft created only. Publishing requires approval.") is clear and builds trust.

---

## What Still Felt Manual

- **Writing the actual good copy** — the generated drafts are not usable without significant editing. The owner still has to rewrite everything from scratch.
- **Giving AÏKO context about itself** — there's no way to tell AÏKO "this is what AÏKO actually does" except by editing the project description manually. There's no "teach AÏKO about this project" flow.
- **Creating tasks from the plan** — the plan was in the chat response but I had to manually ask to create tasks. There's no auto-suggested "Create tasks from this plan" chip in the response.
- **Saving everything explicitly** — "save it" must be in every command or outputs are lost.

---

## Top 5 Blockers

1. **Project memory is too thin.** The AI generates generic copy because it only has `name`, `goal`, and `target_market` in the DB. Real marketing copy requires product positioning, key differentiators, tone, examples, customer language — none of which AÏKO can currently access.

2. **No project-specific "what should I do?" intent.** "What should I do today for project X?" falls into `daily_brief` instead of producing project-specific strategic advice. This is the most natural daily-use question.

3. **Outputs are not saved by default.** The 7-day plan was generated but not saved to `/files`. The owner must remember to say "save it" every time.

4. **No draft continuity.** If you run "Create a LinkedIn post" twice, you get two separate files with no connection. There's no "here's the previous draft, revise it" flow.

5. **Kevin's skill resolution is fragile for natural language site references.** "Open relevant websites" fails; "Open LinkedIn" works. The owner has to name sites precisely, not describe their intent.

---

## Recommended v0.3.0 Focus

**Project memory and context quality.**

See `AIKO_V0_3_FOCUS_RECOMMENDATION.md`.
