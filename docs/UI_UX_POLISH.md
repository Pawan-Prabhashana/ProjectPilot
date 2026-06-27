# UI/UX Polish — Part 11

## Overview

Part 11 improved the visual quality and usability of ProjectPilot without rewriting components
or introducing new design systems. Changes focus on the most visible demo surfaces and
follow the platform's neurodivergent-first design principles.

## Landing page update

The public landing page (`app/(public)/page.tsx`) was significantly expanded.

### Added sections

| Section | Purpose |
|---|---|
| Workflow steps (6 steps) | Shows the full formation pipeline from profile collection to risk monitoring |
| Role-based sections | Separate feature lists for Coordinator, Student, and Supervisor |
| Explainability section | Explains that every decision is transparent and deterministic |
| Neurodivergent-first section | Describes the 6 private support features students can enable |

### Retained sections
- Navigation with "Open demo" CTA
- Hero headline: "Form balanced student project teams — then keep them on track."
- Problem section (6 pain points)
- Feature cards (6 capabilities)
- Design principles (Low Cognitive Load, Predictable Structure, Explicit Communication)
- Demo CTA with account credentials
- Footer

### Changes to existing content
- "Start for free" button renamed "Open demo" to better match the demo-first context
- Demo accounts table improved with role descriptions ("Full formation workflow", "Capstone journey view", "Team oversight")
- Hero subtext updated to mention monitoring through the semester
- Footer updated to include "Deterministic · Explainable · Privacy-first"

## Low-cognitive-load design principles

Maintained throughout all UI changes:
- **Predictable layouts**: consistent page headers using `PageHeader` component across all pages
- **Short paragraphs**: no long blocks of text in cards or explanations
- **Obvious next actions**: explain panels show `recommendedActions` as a clear list with arrow icons
- **No noisy animations**: no CSS animation libraries added; only existing Tailwind transitions used
- **Readable badge labels**: severity and status badges use consistent colour mapping (`SEVERITY_BADGE`, `STATUS_BADGE`)
- **Plain-language explanations**: all generated text uses plain prose, not technical jargon

## Formation workspace polish (`/dashboard/coordinator/team-formation`)

Added:
- **"Why were these teams suggested?" expandable panel** below the run summary card
- Panel shows: deterministic explanation label, summary text, key reasons, risks, and recommended actions
- Panel is collapsed by default (low cognitive load — only shown on demand)
- Uses amber colour scheme to distinguish from operational cards
- Controlled by `showRunExplain` / `runExplain` state; fetches from `/api/explainability/team-formation`

## Conflict dashboard polish (`/dashboard/coordinator/conflicts`)

Added:
- **"What should I fix first? (explain)" expandable panel** below the recommended actions card
- Panel shows: deterministic explanation, key issues, and priority actions
- Uses amber colour scheme consistent with the formation workspace panel
- Controlled by `showExplain` / `explain` state; fetches from `/api/explainability/conflicts`

## Student journey polish (`/dashboard/my-work`)

Added:
- **"What should I do next?" collapsible section** inside the Capstone Journey card
- Uses a native `<details>/<summary>` element — no JS state needed (server-rendered)
- Shows: deterministic explanation label, summary, recommended actions, privacy note
- Privacy note confirms support preferences are never shared with coordinators or supervisors

## Key pages and shared components used

| Component | Usage |
|---|---|
| `PageHeader` | All coordinator and student pages |
| `Card`, `CardContent`, `CardHeader`, `CardTitle` | All dashboard pages |
| `Badge` | Status, severity, source labels throughout |
| `Button` | All action triggers |
| `InfoCallout` | No-team state for students |

No new component library dependencies were added in Part 11.

## Reusable components available

The following shared components already exist and should be used for new pages:

| Component | Path | Props |
|---|---|---|
| `PageHeader` | `components/shared/page-header.tsx` | `title`, `description`, `badge`, `actions` |
| `InfoCallout` | `components/shared/info-callout.tsx` | `variant`, `title`, children |
| `EmptyState` | `components/shared/empty-state.tsx` | (inspect for API) |
| `HealthBadge` | `components/shared/health-badge.tsx` | (inspect for API) |

## Accessibility / neurodivergent-first design choices

- All expand/collapse panels are keyboard-accessible (buttons and `<details>`)
- Colour is never the sole indicator of status — text labels always accompany badges
- Icons use `shrink-0` to prevent layout shifts on long text
- Error/warning states use both colour and icon (e.g. `AlertTriangle` + amber/red)
- "Deterministic explanation" label always shown so users understand the source of AI-adjacent text

## Remaining future polish ideas

1. **Dark/light mode toggle**: currently dark-only landing page; dashboard uses system default
2. **Skeleton loading states**: pages currently show a spinner; skeleton cards would feel smoother
3. **Toasts for non-destructive actions**: currently used for publish/save; could expand to all mutations
4. **Mobile-first review of coordinator formation workspace**: current layout is desktop-first
5. **"Explain this team" per-card expand** in the team formation workspace (per-team rather than per-run)
6. **Animated progress indicators** on the student Capstone Journey steps (opt-in, reduced motion respecting)
