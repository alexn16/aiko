# AÏKO Task Title UX Audit

## Bad title patterns found

| Source | Example bad title | Problem |
|---|---|---|
| `createTaskFromAgentMessage` via `sendAgentMessage` | `"Blocked: Search: in this browser all is unblocked you just have to use them"` | Raw user command used as search query, then as task title |
| `createOperatorTaskFromAgentRequest` | `"Web Operator: search on reddit.com"` | Technical prefix, lowercase action |
| `app/api/ai-skills/create-tasks` | `"Validate the competitor email domain using WHOIS lookup"` | Verbatim AI output, too long, technical |
| Intensive work task_creation | `"Follow-up task"` | Generic fallback |
| AI skill output title | `"Plan the next 7 days of marketing work."` | Raw prompt reused as task title |
| Strategy execution plan | `"Prepare Reddit strategy inputs and draft materials internally."` | Long, technical, includes "internally" |

## How titles reach /tasks

1. `sendAgentMessage(subject: "Blocked: ${req.instruction}")` → `createTaskFromAgentMessage(subject)` → `cleanTaskTitle(subject)` → stored
2. `createOperatorTaskFromAgentRequest(req.instruction)` → stored directly (improved in previous session)
3. `app/api/ai-skills/create-tasks` → `textFromTaskItem(item).title` → stored without normalisation
4. `lib/intensive-work/engine.ts` task_creation → `item.input.title ?? 'Follow-up task'` → stored without normalisation

## Source label issues

- `assigned_by_role = 'Strategy Execution Planner'` → displayed as raw string
- `assigned_by_role = 'intensive_work'` → displayed as "intensive work"
- `assigned_by_role = 'ai_skill'` → "AI skill" (good)
- `task_type = 'project_map'` → shows as "project map" (technical)

## Fix plan

1. `lib/tasks/task-title-normalizer.ts` — `normalizeTaskTitle` + `normalizeTaskDescription`
2. Apply at creation time in `ai-skills/create-tasks/route.ts`
3. Apply at render time as fallback in `/tasks` and `/home` Next tasks
4. Improve `sourceLabel` in `owner-tasks.ts`
