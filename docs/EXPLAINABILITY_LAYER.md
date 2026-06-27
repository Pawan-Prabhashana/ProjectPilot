# Explainability Layer — Part 12

## Why explainability matters

ProjectPilot uses deterministic scoring engines for team formation, role assignment, and task allocation.
These engines produce consistent, reproducible results — but without readable explanations,
coordinators, students, and supervisors cannot understand _why_ a team was formed a certain way,
_why_ a role was suggested, or _what_ to fix first when risks appear.

The explainability layer bridges this gap: every key decision in the platform has a human-readable
summary that can be shown in the UI without requiring AI.

## Deterministic engines remain the source of truth

**AI never makes final allocation decisions silently.**
The formation engine, role suitability scorer, and task allocation recommender are all deterministic.
Explanations are generated _from_ their outputs — they describe what the engine decided, not the other way around.

All explanations use the wording:
> "Based on ProjectPilot's scoring data…"

Not:
> "The AI decided…"

## What explanations are generated

| Context | Function | Description |
|---|---|---|
| Formation run | `explainTeamFormationRun(runId)` | Summarises total teams, avg score, unassigned students, warning count |
| Draft team | `explainDraftTeam(draftTeamId)` | Explains skill coverage, schedule overlap, preference match, role balance |
| Role assignment | `explainRoleAssignment(draftTeamMemberId)` | Shows skills, role preferences, fit score, confidence |
| Task recommendation | `explainTaskRecommendation(input)` | Shows skill match, role alignment, capacity, and load balance |
| Conflict dashboard | `explainConflictDashboard(termId?)` | Summarises missing profiles, missing preferences, open conflicts |
| Student next steps | `explainStudentNextSteps(userId)` | Tells student what to do next based on their journey state |

## Deterministic vs optional AI-enhanced explanations

### Deterministic (default, always active)
- Works offline with no external API keys
- Generated from Prisma queries on the live database
- Consistent and reproducible
- Displayed with label: **"Deterministic explanation"**

### AI-enhanced (optional, never required)
- Enabled only when:
  - `EXPLAINABILITY_MODE="ai_enhanced"` is set in `.env`
  - `AI_API_KEY` is set and non-empty
- Falls back to deterministic if key is absent, invalid, or provider is unreachable
- Displayed with label: **"AI-enhanced explanation"**

The build and dev server work fully without any AI key configured.

## Privacy boundaries

The explainability layer **never** reads:
- `CognitiveProfile` records
- `StudentFormationProfile.privateSupportNotes`
- Diagnosis labels or clinical terms

It may show safe generic guidance such as:
- "This team may benefit from clear written instructions."
- "This task should include a clear definition of done."

These come from safe support preference flags (e.g. `prefersWrittenInstructions`), not from private clinical notes.

## Where explanations appear in the UI

| Page | Panel | Trigger |
|---|---|---|
| `/dashboard/coordinator/team-formation` | "Why were these teams suggested?" | Expandable button below run summary card |
| `/dashboard/coordinator/conflicts` | "What should I fix first?" | Expandable button below recommended actions panel |
| `/dashboard/my-work` (student) | "What should I do next?" | Collapsible `<details>` inside the Capstone Journey card |

## API routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/explainability/team-formation` | GET | Coordinator | `?runId=` or `?draftTeamId=` |
| `/api/explainability/task-allocation` | POST | Any authenticated | Body: `TaskRecommendationExplainInput` |
| `/api/explainability/conflicts` | GET | Coordinator | `?termId=` (optional) |

## File structure

```
lib/services/explainability/
  types.ts                      — shared TypeScript types
  deterministic-explanations.ts — all deterministic generator functions
  explainability-service.ts     — public API (orchestrates, handles AI flag)
```

## How explainability supports the viva/demo

During a viva or demo, the explainability layer lets you:
1. Show the team formation workspace and click "Why were these teams suggested?" to get an instant, readable explanation.
2. Show the conflict dashboard and click "What should I fix first?" to get prioritised recommended actions.
3. Log in as a student and open the "What should I do next?" explanation inside the Capstone Journey card.

This directly answers the common evaluation question: _"Is this system a black box, or can you explain its decisions?"_

## Why AI does not make hidden allocation decisions

- The formation engine uses weighted scoring across skill, schedule, preference, and role dimensions.
- Scores are stored on `DraftTeam`, `DraftTeamMember`, and `TaskAllocationRecommendation` records.
- Explainability reads those persisted scores and formats them as prose — it does not rerun the engine.
- If `EXPLAINABILITY_MODE` is `deterministic` (or no AI key is set), no external API is called at all.
- Transparency is guaranteed regardless of AI availability.

## Future additions (not in Part 12)
- Per-team AI-enhanced narrative (if AI key is configured)
- Bulk export of formation explanations as PDF/markdown
- Supervisor-facing team composition explanation
