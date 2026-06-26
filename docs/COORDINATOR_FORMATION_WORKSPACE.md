# Coordinator Formation Workspace (Part 6)

## Overview

The Coordinator Formation Workspace (`/dashboard/coordinator/team-formation`) is the final human-in-the-loop layer between the deterministic team formation engine (Part 5) and the operational teams that students work in.

After the engine produces draft teams, a coordinator reviews the results, makes lightweight manual adjustments, and explicitly approves (publishes) the teams. Only then are real `Team`, `TeamMember`, and `Project` records created.

---

## Draft Teams vs Published Teams

| Concept | Draft | Published |
|---|---|---|
| Model | `DraftTeam` / `DraftTeamMember` | `Team` / `TeamMember` / `Project` |
| Created by | Formation engine (Part 5) | Coordinator publish action (Part 6) |
| Editable? | Yes — name, status, roles, topic, member moves | No — operational data |
| Visible to students? | No | Yes (via existing team pages) |
| Deleted on re-run? | No — kept as historical record | No |
| Links to draft? | — | `Team.sourceDraftTeamId → DraftTeam.id` |

---

## Coordinator Review Process

1. **Run the engine** — click "Run Formation Engine" or use the Formation Setup page. The engine creates a `TeamFormationRun` with `DraftTeam`, `DraftTeamMember`, and `DraftTeamWarning` records.
2. **Inspect draft teams** — each team card shows:
   - Name and assigned project topic
   - Supervisor (if matched by the engine)
   - Overall score and component scores (Skill, Schedule, Role, Preference, Capacity, Support, Supervisor)
   - Members with suggested roles and fit scores
   - Warnings (CRITICAL / HIGH / MEDIUM / LOW / INFO)
   - Engine explanation text
3. **Filter teams** — use the filter bar to show: All / Needs Review / Ready / Has Warnings
4. **Make adjustments** (see below)
5. **Mark teams READY or LOCKED** — all teams must be READY or LOCKED before publishing
6. **Run readiness check** — the "Check Readiness" button calls the validation API and shows a per-team checklist
7. **Publish** — if all checks pass, click "Publish Teams". Confirm the action. Operational records are created.

---

## Manual Adjustments Supported in Part 6

### Rename a Draft Team
Click the pencil icon next to the team name. Edit and press Enter or click the checkmark. Calls `PATCH /api/formation-workspace/draft-team/[draftTeamId]`.

### Change Draft Team Status
Use the status buttons at the bottom of an expanded team card. Statuses: `DRAFT → NEEDS_REVIEW → READY → LOCKED`. Calls `PATCH /api/formation-workspace/draft-team/[draftTeamId]`.

### Change Assigned Topic
Planned for a future update — currently topic is set by the engine and displayed. Coordinators can manually update `topicId` via the PATCH API if needed.

### Change a Member's Suggested Role
Click the pencil icon next to the member's role badge. Select a new role from the dropdown and confirm. Calls `PATCH /api/formation-workspace/member/[memberId]`. The dropdown now lists the full Part 7 role catalogue (plus Co-Leader), so manual overrides use the same role keys the engine assigns.

**Part 7 role suitability (read-only context shown per team):**
- Each member shows a **role confidence** score (0–100 suitability) next to their fit score.
- A **Why this role** line gives the deterministic, privacy-safe reason for the suggested role (skills matched, stated preference, project alignment).
- Each expanded team shows a **Role Coverage** summary: covered / weak / missing required roles and a coverage score.
- Role gaps appear among the team's warnings (`NO_CLEAR_LEADER`, `MISSING_ROLE_COVERAGE`, `LOW_ROLE_CONFIDENCE`, `ROLE_AVOIDANCE_CONFLICT`, `ROLE_SKILL_MISMATCH`). See [ROLE_SUITABILITY_ENGINE.md](ROLE_SUITABILITY_ENGINE.md).

### Move a Member to Another Team
Click "Move" next to a member. A modal dialog appears with a dropdown of other teams in the same run. Select the target team and confirm. Calls `POST /api/formation-workspace/move-member`.

**Safety rules enforced:**
- A student cannot appear in two teams in the same run.
- The target team must be in the same formation run.

---

## Publish Validation Rules

Before publishing, the system validates:

| Rule | Blocking? |
|---|---|
| Run must exist | Yes |
| Run status must be `COMPLETED` | Yes |
| Run must not already be published | Yes |
| No `Team.sourceDraftTeamId` already matches a draft team in this run | Yes |
| All draft teams must have at least one member | Yes |
| Team sizes must be within batch min/max | Yes (if violated) |
| Every draft team must be `READY` or `LOCKED` | Yes |
| No unresolved `CRITICAL` warnings on any team | Yes |
| `HIGH` warnings are surfaced but do not block | No (warned) |
| One student must appear at most once in the entire run | Yes |

---

## What Publishing Creates

For each `DraftTeam`:

1. **`Team` record** — `name`, `slug`, `academicTermId`, `formationBatchId`, `supervisorId`, `sourceDraftTeamId`
2. **`TeamMember` records** — one per `DraftTeamMember`, with role mapped:
   - `team_leader` → `LEADER`
   - `co_leader` → `CO_LEADER`
   - anything else → `MEMBER`
3. **`Project` record** — `title` from `ProjectTopic.title` (or team name if no topic), `description` from topic, linked to the new `Team`
4. **`StudentIntake.status`** updated to `ASSIGNED_TO_TEAM`
5. **`FormationBatchStudent.status`** updated to `ASSIGNED`

After all teams are published:
6. **`FormationBatch.status`** updated to `PUBLISHED`
7. **`TeamFormationRun.publishedAt`**, `publishedById`, `publishSummary` set
8. **Each `DraftTeam.status`** updated to `LOCKED`

Publishing is executed in a single Prisma transaction with a 30-second timeout. If any step fails, the entire transaction is rolled back.

---

## What Statuses Mean

### `TeamFormationRun.status`
| Status | Meaning |
|---|---|
| `QUEUED` | Run created but engine not started |
| `RUNNING` | Engine is actively computing |
| `COMPLETED` | Engine finished; draft teams available for review |
| `FAILED` | Engine failed; see `failureReason` |
| `ARCHIVED` | Run archived (not currently used in UI) |

### `DraftTeamStatus`
| Status | Meaning |
|---|---|
| `DRAFT` | Default; not yet reviewed by coordinator |
| `NEEDS_REVIEW` | Coordinator flagged for attention |
| `READY` | Coordinator approved; can be published |
| `LOCKED` | Published or explicitly locked |

### `FormationBatchStatus` (after publish)
| Status | Meaning |
|---|---|
| `PUBLISHED` | Formation workspace has been published into operational teams |

---

## API Reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/formation-workspace/overview` | Workspace overview (term, batch, latest run, isPublished) |
| `GET` | `/api/formation-workspace/run/[runId]` | Full run details with draft teams, members, warnings |
| `PATCH` | `/api/formation-workspace/draft-team/[draftTeamId]` | Update team name, status, or topic |
| `PATCH` | `/api/formation-workspace/member/[memberId]` | Update member's suggested role |
| `POST` | `/api/formation-workspace/move-member` | Move a member between draft teams |
| `POST` | `/api/formation-workspace/publish` | Validate and/or publish a formation run |

All routes are coordinator-only and use `getServerSession(authOptions)` directly (not `requireAuth()`).

---

## Privacy Boundaries

- `CognitiveProfile` is **never queried** in any workspace service or API.
- `StudentFormationProfile.privateSupportNotes` is **never selected or returned**.
- Member views surface only: name, suggested role, role confidence, fit score, and explanation.
- The publish process uses `studentProfile.userId` and `studentProfile.id` — no diagnostic or neurodivergent data.

---

## What Later Parts Will Add

| Part | Enhancement |
|---|---|
| Part 7 | Role suitability engine — deeper role-skill gap detection and better role assignment confidence — **done** (see [ROLE_SUITABILITY_ENGINE.md](ROLE_SUITABILITY_ENGINE.md)) |
| Part 8 | Capacity-aware task allocation — recommend (never auto-assign) task assignees based on capacity and role — **done** (see [CAPACITY_AWARE_TASK_ALLOCATION.md](CAPACITY_AWARE_TASK_ALLOCATION.md)) |
| Part 9 | Conflict/gap dashboard — unified view of unresolved formation conflicts, skill gaps, and schedule conflicts |
| Part 10 | End-to-end workflow polish — coordinator bulk actions, student notifications on publish, formation report export |
