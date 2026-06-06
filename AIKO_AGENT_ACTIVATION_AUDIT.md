# AÏKO Agent Activation Audit

## Current Behavior

- CEO Chat routes owner commands through `app/api/ceo/command/route.ts`.
- Internal tasks already exist in `agent_tasks` and are surfaced in `/tasks`, `/home`, and project workspaces.
- `/agents` previously showed built-in and custom agent specifications, but it did not derive working state from `agent_tasks`.
- Some CEO responses could say assignment-like language because the model generated prose, but no guaranteed task, runner, output artifact, or agent activity state was created.

## Missing Links Found

- No dedicated guard intercepted assignment commands before generic CEO prose.
- No runner turned “assign Sven” into a concrete `agent_tasks` row.
- Agent task metadata did not expose `assigned_agent_name`, output summary, or output file links to the owner UI.
- `/agents` did not show named assigned agents such as Sven if they were created by task assignment rather than saved custom-agent specs.
- Repo/product audit work had no safe internal task type that could read local docs/code summaries and create an artifact.

## Fixes Applied

- Added `lib/agents/agent-runner.ts`.
- Added assignment intent detection for commands such as:
  - “Assign Sven to inspect the repo.”
  - “Start prompting yourself and the repo you are on.”
  - “Assign Sven to audit how AÏKO works and what needs to improve next.”
- Added `repo_operational_audit` as an internal task type.
- Agent assignment now:
  - creates an `agent_tasks` row,
  - stores assigned agent metadata in task `output`,
  - marks the task `assigned` then `working`,
  - runs the internal task synchronously for short repo-audit work,
  - writes a generated Markdown report,
  - creates an `agent_task_outputs` row,
  - marks the task completed or blocked,
  - returns CEO chips for task/report/agents.
- `/tasks` now shows assigned agent names and output links.
- `/home` Next tasks now shows assigned agent names and output links.
- `/agents` now shows “Assigned Agent Work” for named agents with task activity, so agents do not appear idle when real work exists.

## Safety Notes

- The runner does not send, post, publish, message, or open external websites.
- The repo audit reads a fixed list of safe local files and redacts common secret/token patterns before prompting or saving.
- The repo audit does not run destructive commands.
- If model execution fails, the runner produces a deterministic internal audit fallback rather than faking external research.
- Web Operator actions are not created by agent assignment or task completion.

## Remaining Limits

- Agent execution is synchronous and intended for short internal tasks only.
- Long-running background workers are still not implemented.
- `/agents` derives named assigned-agent state from recent task records; it is not a full agent runtime monitor.
- Fresh external facts still require Web Operator research.
