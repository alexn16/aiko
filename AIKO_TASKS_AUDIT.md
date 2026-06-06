# AÏKO Tasks Audit

Date: 2026-06-06

## Existing Model

Internal work already uses the `agent_tasks` table from `lib/db/migrations/010_agent_tasks.sql`.

Supported fields include:

- `project_id`
- `owner_role`
- `assigned_by_role`
- `title`
- `description`
- `status`
- `priority`
- `task_type`
- `output`
- `due_at`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

Tasks are project-scoped when `project_id` is present. They can also be company-level when `project_id` is null.

## Existing APIs

The existing advanced task API is:

- `GET /api/agent-tasks`
- `POST /api/agent-tasks`
- `PATCH /api/agent-tasks/[id]`
- `POST /api/agent-tasks/[id]/generate-output`

`/api/ai-skills/create-tasks` creates `agent_tasks` only. It does not create Web Operator actions, approval items, browser sessions, sends, posts, publishes, or messages.

## Existing UI

Before this pass:

- Project workspaces had a `Tasks` tab through `components/agents/TasksPanel`.
- That panel was useful but agent-oriented and dense.
- `/home` did not show the tasks created from AI skill outputs.
- There was no simple owner-facing `/tasks` page.

## Owner-Facing Additions

This pass adds a simple owner task layer on top of the existing table:

- `GET /api/tasks`
- `PATCH /api/tasks/[id]`
- `/tasks`
- `/home` “Next tasks” card
- Project workspace `Tasks` tab using the simple task panel by default

The owner API maps internal statuses to simple owner statuses:

- `planned` -> `todo`
- `completed` -> `done`
- `in_progress` -> `in_progress`
- `blocked` -> `blocked`
- `archived` -> `archived`

The advanced agent task tools remain available behind an Advanced section in the project Tasks tab.

## Safety

Task management remains internal only.

Task status updates:

- do not create Web Operator actions
- do not create approval items
- do not open websites
- do not send, post, publish, message, or resume operators
- do not approve anything
