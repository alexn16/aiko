# AÏKO Web Research Fix Report

## Current Flow

Before this pass, browser research entered AÏKO mainly through:

- CEO Chat intent detection in `app/api/ceo/command/route.ts`.
- Generic web research phrases such as `search`, `find`, `research`, `browse`, `web`.
- Named Web Operator commands such as `Kevin, open Canva`.
- Web Operator delegation in `lib/web-operator/delegation.ts`.
- Playwright execution in `lib/web-operator/playwright-executor.ts`.
- Step 3 of `/start-campaign`, which either runs lead discovery or delegates a research prompt to Web Operator.

The low-level browser path was mostly present: searches use a real Playwright browser, DuckDuckGo HTML first, Google fallback, page-state detection, screenshots, action logs, and waiting-user states for login/CAPTCHA/security.

## Failures Found

- High-level phrases such as `Start marketing for ALB Parking`, `Promote AÏKO`, and `get this project moving` did not reliably trigger browser research because the generic detector only recognized lower-level research words.
- AÏKO often felt like it was planning instead of working because the CEO route waited for model intent before delegation and did not have a direct "start working" marketing path.
- Search results could be weak or empty because a single generic query was used; when search extraction returned zero results, the main user copy did not clearly say what happened.
- Browser work existed, but it was buried in `/operators` and `/start-campaign`; there was no minimalist control center focused on "what is Kevin doing now?"
- CAPTCHA/login/security takeover copy exposed too much implementation detail and used the older `Login / CAPTCHA completed` label.
- Approval copy described internal request mechanics instead of the simple user need.
- Runtime validation found `Start marketing for ALB Parking.` resolving to the latest active project because final punctuation was not accepted as a project-name terminator.

## Fixes Applied

- Added `project_autopilot_marketing` detection for:
  - `start marketing`
  - `promote this project`
  - `promote AÏKO`
  - `find customers`
  - `find leads`
  - `start promotion`
  - `research where to promote`
  - `open websites and start marketing`
  - `get this project moving`
  - `what should we do now for marketing`
- Added `lib/web-operator/marketing-research-runner.ts`.
  - Builds a short visible plan.
  - Generates 3-5 practical search queries.
  - Uses existing safe Web Operator delegation and Playwright browser execution.
  - Opens direct public targets such as Reddit, Product Hunt, Hacker News Algolia, and LinkedIn/Facebook-style public search URLs when useful.
  - Extracts only visible result titles, URLs, and snippets from real browser output.
  - Never creates fake leads; zero-result research returns an honest no-results message.
- Added `/home` as a minimalist control center.
  - Big command box.
  - Active project selector.
  - Buttons for Start marketing, Find customers, Research competitors, Create content, Generate report, and Open browser operator.
  - Live work card with simple statuses.
  - Attention card for help, approval, browser blocked, and done.
  - Advanced details are hidden behind `<details>`.
- Root `/` now redirects to `/home` after setup.
- Simplified main-flow copy:
  - CAPTCHA/login/security: `Kevin needs your help. Complete this in the browser, then click Resume.`
  - Approval: `Kevin needs approval before doing this.`
  - Read-only mode: `AÏKO is in Read Only mode. Switch to Approval mode to let Kevin use the browser.`
  - Browser missing: `Browser runtime is missing. Run: npx playwright install chromium`
  - No results: `Research finished, but no useful results were extracted. Try a more specific target or let Kevin open websites directly.`
- Updated operator detail page to show a `Resume` button in the main takeover flow.
- Fixed punctuated project-name extraction so commands such as `Start marketing for ALB Parking.` and `Find customers for Demo Parking?` resolve to the named project instead of falling back to the latest project.

## Runtime Validation

Command:

```bash
AIKO_AUTH_MODE=optional PORT=3001 WEB_OPERATOR_HEADLESS=false npm run dev
```

Results:

- `/api/health` returned `ok=true`, database reachable, setup complete, Web Operator runtime available, headed mode enabled, and storage writable.
- `/home` rendered after a fresh dev restart with the project selector, quick action buttons, Live Work, Attention, and hidden Advanced details.
- `Start marketing for ALB Parking.` created a `project_autopilot_marketing` response attached to the ALB Parking project, opened public research targets, and paused at LinkedIn login/security with simple Resume copy.
- `Promote AÏKO.` used AÏKO-specific public targets, including Product Hunt and Hacker News Algolia, without attaching the run to the wrong project.
- No results were fabricated when visible extraction returned no useful opportunities.
- No Web Operator action attempted posting, sending, messaging, publishing, sharing, downloading, CAPTCHA bypass, or login bypass.

## Remaining Limitations

- Search remains browser-based and can still be blocked by search engines. AÏKO does not bypass CAPTCHA or security checks.
- Direct public sites may still show login walls or bot checks. AÏKO pauses instead of bypassing.
- The first autopilot implementation is intentionally conservative: it searches and opens safe public pages but does not automate posts, messages, joins, downloads, or sends.
- Lead creation still requires visible company/source data. AÏKO will not invent leads from weak snippets.
- `/dashboard`, `/system`, `/operators`, and playbook pages still expose advanced controls for owner/debug use; `/home` is the simplified daily control surface.
