# AÏKO MVP Demo Script

This is a concise 10-minute owner demo. It shows what AÏKO can do today, where the safety gates are, and how the self-improvement loop works without implying silent code changes or automatic external messaging.

## Demo Setup

- App running locally, usually `AIKO_AUTH_MODE=optional PORT=3001 npm run dev`.
- Database connected.
- CEO brain connected, or Ollama local connected for the demo.
- Playwright Chromium installed.
- Web Operator can run, preferably headed mode for visual takeover demos: `WEB_OPERATOR_HEADLESS=false`.
- Use a demo project name: `Demo Parking`.

## 10-Minute Flow

### 1. Dashboard

Open `/dashboard`.

Show:
- CEO brain status.
- Setup status.
- Current operating mode.
- Owner warnings.
- Active projects, active Web Operators, waiting user count, pending approvals, and improvement proposals.
- Quick links to CEO Chat, Start Campaign, Operators, Approvals, Files, and System Improvements.

Say:
> This is the owner overview. It tells me whether AÏKO is ready, what needs attention, and where the safe control points are.

### 2. Setup

Open `/setup`.

Show:
- First-run provider connection.
- Ollama connected if this is the local demo brain.
- ChatGPT/Codex and Claude connection truth: connected only when OAuth/API/CLI credentials actually work.

Say:
> AÏKO does not fake provider connections. If ChatGPT or Claude is not configured, the UI says so. Ollama can be used as a local fallback.

### 3. CEO Chat

Open `/ceo`.

Ask:
> Hello, what are you?

Then ask:
> Create a marketing project for Demo Parking.

Show:
- CEO response.
- Project creation chip or project link.
- Project context created without sending anything externally.

Say:
> The CEO coordinates the company. It can create projects and assign internal work, but external actions remain gated.

### 4. Start Campaign

Open `/start-campaign`.

Show:
- Strategy brief.
- Launch template.
- Recommended operator.
- Approval-aware campaign flow.

Say:
> Campaign launch is structured. AÏKO plans strategy, drafts work, and recommends operators, but approval remains separate from execution.

### 5. Web Operator Task

In CEO Chat, ask:
> Kevin, open Canva and create a draft Instagram post for Demo Parking.

Show:
- Direct Canva opening if the operator runs.
- Manual takeover or security/login behavior if Canva blocks automation.
- No publish, share, or download without approval.

Say:
> Kevin can operate visible websites through the browser. If there is login, CAPTCHA, QR, or a security checkpoint, he pauses and waits for manual takeover. Publishing and sharing are not automatic.

### 6. Operator Detail

Open `/operators/[id]` for the active operator.

Show:
- Current URL.
- Page title.
- Latest safe screenshot.
- Current playbook.
- Playbook execution checklist.
- Waiting reason if present.
- Manual takeover controls:
  - `I'm taking over`
  - `Login / CAPTCHA completed`
  - `Resume`
  - `Pause`
  - `Clear workflow`

Say:
> This is the audit trail for browser work. The checklist shows planned and current steps. Waiting states are explicit and cannot be bypassed by the app.

### 7. Approvals

Open `/approvals`.

Show:
- Pending approval items if available.
- Approval details.
- That approval is separate from execution.

Say:
> Approval does not mean silent execution. Risky actions still require an explicit resume or controlled next step.

### 8. Executive Report

In CEO Chat, ask:
> Generate an executive report for Demo Parking.

Open the project Reports tab or `/reports`.

Show:
- Generated executive report.
- Markdown export.
- JSON export.

Say:
> Reports are internal artifacts. They summarize project strategy, work, blockers, approvals, and next steps.

### 9. Files

Open `/files`.

Show:
- Generated files.
- Project bundle if available.
- Reports, strategy briefs, decisions, and exports.

Say:
> Files are the internal operating record. They can be exported without sending outreach or posting externally.

### 10. System Improvements

Open `/system`.

Show:
- Capability map.
- Improvement proposal.
- Codex-ready implementation prompt.
- Lifecycle state: proposed, approved, in progress, pending validation, validated, rejected.
- Validation guard message if a skill/playbook is missing.

Say:
> Safe self-improvement means AÏKO detects missing capabilities, creates a proposal and implementation prompt, and waits for user approval. It does not modify its own code silently. A capability is only marked available after implementation and validation.

## Close

End with:
> The MVP is an owner-supervised marketing operating system: CEO planning, project execution, browser operators, approvals, generated files, and a controlled self-improvement loop. It is intentionally safe by default.

## Things Not To Claim

- Do not claim ChatGPT/Codex or Claude is connected unless the setup page shows a working connection.
- Do not claim AÏKO can send WhatsApp, Facebook, LinkedIn, Gmail, or email messages automatically.
- Do not claim AÏKO bypasses CAPTCHA, login, QR, 2FA, or security checkpoints.
- Do not claim self-improvement modifies code inside the app.
- Do not claim approval and execution are the same action.
