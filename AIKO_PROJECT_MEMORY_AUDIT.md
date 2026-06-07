# AÏKO Project Memory Audit

## What is currently stored

| Source | Fields |
|---|---|
| `projects` table | id, name, goal, description, target_market, value_prop, strategy JSONB |
| `project_memory` | notes, next_steps JSONB[], blockers JSONB[], context JSONB |
| `project_strategy_briefs` | objective, target_audience, research_prompt, channel, value_prop |
| `project_decisions` | last 6 decisions (type, title, summary) |
| `project_strategy_execution_plans` | latest plan with missing_capabilities |
| `company_memory` | summary, global_priorities, blocked_items |

## What is injected into AI prompts

`getProjectExecutiveSummary()` in `lib/project-context.ts` produces a plain-text block injected into:
- `lib/ai-skills/content-executor.ts:111` — content skills
- `lib/ai-skills/research-executor.ts:297` — research/strategy skills

The CEO command agent `buildCompanyContext()` loads company_memory and a project list snapshot, but NOT the deep project executive summary for each project.

## Why AÏKO output was generic

For the AIKO project (newly created), the DB had only:
- name: "AIKO"
- goal: "Promote AIKO as a local AI Marketing Operating System."
- target_market: "Developers, solo founders, and small marketing teams."

No strategy brief, no memory notes, no decisions, no value prop, no tone, no differentiators.

`getProjectExecutiveSummary()` therefore produced a ~5-line summary with only these three fields. The AI generated generic "writing assistant" copy because that's what it hallucinated from the minimal context.

## Which files need changes

1. `lib/project-brain.ts` (NEW) — load/format/seed the project brain
2. `lib/ai-skills/content-executor.ts` — prepend project brain to prompt
3. `lib/ai-skills/research-executor.ts` — prepend project brain to prompt
4. `lib/agents/ceo-command-agent.ts` — include project brain in company context
5. `lib/browser/controller.ts` — remove --no-sandbox from system_chrome
