# Capacity-Aware Task Allocation — Part 8

Part 8 closes the mentor's loop from team formation down to day-to-day work: once a team exists
(Part 5/6) and members have suggested roles (Part 7), the system can now recommend *who should do
this specific task* — based on skill, role, capacity, current load, due date, and (safely) support
fit — and explain exactly why. It directly targets the mentor's stated pain point:

> "Uneven workload distribution once teams are formed."

> No AI. Deterministic and explainable: same inputs ⇒ same outputs. The engine lives in
> [`lib/services/tasks/task-allocation.ts`](../lib/services/tasks/task-allocation.ts) with pure
> helpers under [`lib/task-allocation/`](../lib/task-allocation/) (`options.ts`, `types.ts`,
> `scoring.ts`).

**Core principle: recommend and explain — never silently auto-assign.** Every recommendation
requires an explicit human click ("Apply") before a task's assignee changes. Manual override to any
team member remains possible at all times.

---

## 1. Why this matters for the mentor scenario

A coordinator or team leader can see *who is on a team* and *what roles they were assigned*, but has
no system support for the next question: *who should pick up this specific task, right now, given
everyone's actual current load?* Without it, the same one or two capable students absorb most of the
work while others sit underused — exactly the "uneven workload distribution" the mentor flagged.

Part 8 makes that judgment call explicit and auditable: every candidate gets a 0–100 score with a
plain-English breakdown, a risk level, and warnings, so the human assigning the task can make an
informed decision in seconds instead of guessing.

---

## 2. What it does NOT do

- It does not auto-assign tasks. `recommendAssigneesForTask()` only returns ranked candidates; a task's
  `assigneeId` only changes when a human applies a recommendation or picks someone manually.
- It does not read `CognitiveProfile` or `StudentFormationProfile.privateSupportNotes` anywhere.
- It does not redefine roles — it reuses the Part 7 role catalogue (`getRoleCatalogue()` from
  [`lib/formation/role-suitability.ts`](../lib/formation/role-suitability.ts)) so task-role inference
  and team-role assignment stay in sync.
- It does not touch draft formation data (`DraftTeam`/`DraftTeamMember`) — it operates entirely on
  published, operational `Team`/`TeamMember`/`Task` rows.

---

## 3. Inputs used by the scoring logic

Loaded once per team by `getTaskAllocationContext(teamId)`:

| Source | Fields used |
|---|---|
| `TeamMember` | `userId`, `profileId`, `role` (MEMBER/LEADER/CO_LEADER) |
| `StudentFormationProfile` | `weeklyCapacityHours`, `maxConcurrentTasks`, `safeSupportPreferences` |
| `StudentSkill` | `skillKey`, `level` (1–5) |
| `StudentRolePreference` | top non-avoided preference, used as a fallback resolved role |
| `Team.sourceDraftTeam.members` | published Part 7 role (`suggestedRoleKey`/`suggestedRoleLabel`), preferred over the raw preference fallback |
| `Task` (active only) | `assigneeId`, `estimatedMinutes`, grouped per member to compute current load |

A member with no formation profile still gets a recommendation — defaults
(`DEFAULT_WEEKLY_CAPACITY_HOURS = 8`, `DEFAULT_MAX_CONCURRENT_TASKS = 2`) apply, and a warning
("No formation profile on file — using default capacity assumptions.") is attached so the human knows
the numbers are assumptions, not real data.

**Never read:** `CognitiveProfile` (any field), `StudentFormationProfile.privateSupportNotes`. Only
`safeSupportPreferences` (a flat `Record<string, boolean>` of non-diagnostic flags) is read, and only
to generate generic task-formatting hints (see §7) — never to score, rank, or exclude a candidate.

---

## 4. Scoring formula and weights

Six dimensions, weighted to sum to 100 (`ALLOCATION_WEIGHTS` in
[`lib/task-allocation/options.ts`](../lib/task-allocation/options.ts)):

| Weight | Value | What it measures |
|---|---|---|
| `skillMatchWeight` | 30 | Does the member have the task's required/preferred skills? |
| `roleMatchWeight` | 20 | Does the member's resolved role fit the skills this task implies? |
| `capacityAvailableWeight` | 20 | How much headroom does the member have against their weekly capacity? |
| `currentLoadFairnessWeight` | 15 | Is this member already carrying more (or less) than the team average? |
| `dueDateFeasibilityWeight` | 10 | Can the member realistically finish by the due date at their current pace? |
| `supportFitWeight` | 5 | Safe, non-diagnostic guidance only — never a penalty. |

`computeOverallScore()` is a straight weighted average, clamped to 0–100.

### 4.1 Skill match (`scoreSkillMatch`)

Required skills weigh 80% of the sub-score, preferred skills 20%. Per skill:

| Member's level on that skill | Contribution |
|---|---|
| ≥ 4 (`SKILL_STRONG_LEVEL`) | 100 — counted as "matched" |
| ≥ 3 (`SKILL_ACCEPTABLE_LEVEL`) | 65 — counted as "matched" |
| 1–2 | 30 — counted as "weak" |
| 0 / not recorded | 0 — counted as "missing" |

No required or preferred skills given → neutral 60 (the task didn't specify, so skill can't be judged
fairly).

### 4.2 Role match (`scoreRoleMatch` + `inferRelevantRoleKeys`)

`inferRelevantRoleKeys(requiredSkills)` reuses the Part 7 catalogue: it ranks every role by how many
of its `coreSkills` overlap with the task's `requiredSkills` (ties broken by catalogue order). For
example `requiredSkills: ['backend', 'database']` ranks `database_designer` and `backend_developer`
highest; `['frontend', 'ui_ux']` ranks `frontend_developer`/`ui_ux_designer` highest;
`['documentation', 'research']` ranks `documentation_lead`/`research_lead` highest.

| Condition | Score |
|---|---|
| Member's resolved role is the *top* relevant role | 100 |
| Member's resolved role is *any* relevant role (not top) | 75 |
| No relevant roles implied by the task | 55 (neutral) |
| Member has a resolved role but it isn't relevant | 40 (skills carry the signal instead) |

### 4.3 Capacity available (`scoreCapacityAvailable`)

Projected utilization = `(currentAssignedHours + newTaskHours) / weeklyCapacityHours`, where
`newTaskHours = (estimatedMinutes ?? DEFAULT_TASK_MINUTES) / 60` — a task with no estimate is assumed
to take 60 minutes, never zero, so it always counts against capacity.

| Utilization | Score |
|---|---|
| ≤ 50% | 100 |
| ≤ 80% | 85 |
| ≤ 100% | 65 |
| ≤ 130% | 40 |
| > 130% | 15 |

### 4.4 Current-load fairness (`scoreCurrentLoadFairness`)

Relative to the **team's mean load ratio** (`teamMeanLoadRatio` — average of every member's
`currentAssignedHours / weeklyCapacityHours`), not an absolute threshold. A member exactly at the team
average scores ~70; below average scores higher (up to 100); above average scores lower:

```
score = clamp(70 - (memberLoadRatio - teamMeanLoadRatio) * 150)
```

This is what actively discourages "always pick the same high-skill student" — a strong skill match on
an already-overloaded member is pulled back down by this dimension. Two extra penalties stack on top:

- −10 if the member's active task count is already at their `maxConcurrentTasks`.
- −25 instead if it's at or above `maxConcurrentTasks + 1` (`SATURATION_BUFFER`) — i.e. clearly
  saturated, not just full.

### 4.5 Due-date feasibility (`scoreDueDateFeasibility`)

No due date → neutral 60. Otherwise: the required daily pace (`newTaskHours / daysUntilDue`) is
compared against the member's *remaining* daily budget (`weeklyCapacityHours / 5` minus their current
daily load):

| Pace ÷ remaining daily budget | Score |
|---|---|
| ≤ 0.5 | 100 |
| ≤ 1.0 | 80 |
| ≤ 1.5 | 55 |
| ≤ 2.0 | 30 |
| > 2.0 | 10 |

Already overdue (`daysUntilDue <= 0`): 50 if the task is small (≤ 2h), else 20. A due date within 1 day
combined with a task over 3 hours caps the score at 30 regardless of the ratio above.

### 4.6 Support fit (`scoreSupportFit`) — safe, non-diagnostic, guidance only

Always scores in **[70, 100]** — it can never push a candidate down, only provide guidance. Only
activates when the task's `cognitiveLoad >= 4` (`HIGH_COGNITIVE_LOAD_THRESHOLD`): it checks the
member's `safeSupportPreferences` against a fixed, generic hint map
(`TASK_GUIDANCE_HINTS` in `options.ts` — e.g. `prefers_smaller_task_chunks` →
"Consider breaking this task into smaller chunks") and surfaces up to 3 hints. No diagnostic label or
cognitive-profile data is ever read or shown.

---

## 5. Current task load (`calculateMemberTaskLoad`, `loadActiveTaskStats`)

"Active" tasks are `TODO`, `IN_PROGRESS`, or `REVIEW` (`ACTIVE_TASK_STATUSES`) — `DONE` and
`CANCELLED` tasks don't count against load. For each active, assigned task,
`estimatedMinutes ?? DEFAULT_TASK_MINUTES` (60) is summed per assignee and converted to hours. This is
the same accounting used for both the scoring dimensions above and the Team Workload Overview (§9).

---

## 6. Risk level (`deriveRiskLevel`)

Each candidate gets a `LOW | MEDIUM | HIGH` risk level with explicit warning strings — this is the
"explain" half of "recommend and explain."

**HIGH** if any of:
- Missing a required skill (`missingSkills.length > 0`).
- Saturated: active task count ≥ `maxConcurrentTasks + 1`.
- Over-utilized: projected utilization > 130%.
- High cognitive load (≥ 4) **and** available capacity hours < half the new task's hours.
- (Tight due date alone does not trigger HIGH on its own, but stacks into the warnings list.)

**MEDIUM** if not HIGH and any of:
- Utilization > 80%.
- Skill score is acceptable but not strong (50–84).
- Due date is tight (`dueDateScore <= 30`).
- Active task count ≥ `maxConcurrentTasks` (full, even if not yet saturated).

**LOW** otherwise.

The recommendation list is still ranked by overall score even when the top pick is MEDIUM/HIGH risk —
the UI always shows the risk badge and warnings next to the recommendation so a human can choose a
safer alternative instead.

---

## 7. Ranking and explanation

`recommendAssigneesForTask(input)`:
1. Loads the team context and infers relevant role keys from `requiredSkills`.
2. Scores every team member across all 6 dimensions.
3. Computes the overall score and risk level per candidate.
4. Sorts by score (desc), then projected hours (asc), then current hours (asc), then name — so ties
   prefer the less-loaded, more-available candidate.
5. Marks only the top candidate as `recommended: true`; everyone else is returned as a ranked
   alternative (the UI shows the top 3).

`explainTaskRecommendation(recommendation)` joins the reasons, "Caution: …"-prefixed warnings, and an
"Overall fit N/100 (risk: LEVEL)" line into one rationale string — this is what gets stored on
`Task.allocationRationale` when a recommendation is applied.

---

## 8. Schema changes

All additions are optional/additive — no existing data or behaviour changes.

**`Task`** — five new nullable columns:

```prisma
requiredSkills      Json?
suggestedRoleKey    String?
allocationRationale String?   @db.Text
allocationScore     Json?
allocationUpdatedAt DateTime?
```

`allocationRationale`/`allocationScore`/`allocationUpdatedAt` are only ever populated when a
recommendation is actually applied (create-time or via reassignment) — creating or editing a task
without using the recommendation panel leaves them `null`, exactly like before Part 8.

**`TaskAllocationRecommendation`** (new model) — an audit-trail row, written every time a
recommendation is applied:

```prisma
model TaskAllocationRecommendation {
  id                           String   @id @default(cuid())
  taskId                       String?
  teamId                       String
  projectId                    String?
  recommendedUserId            String?
  recommendedStudentProfileId  String?
  score                        Int      @default(0)
  skillScore                   Int      @default(0)
  roleScore                    Int      @default(0)
  capacityScore                Int      @default(0)
  currentLoadScore             Int      @default(0)
  dueDateScore                 Int      @default(0)
  supportFitScore              Int      @default(0)
  rationale                    String?  @db.Text
  metadata                     Json?
  accepted                     Boolean  @default(false)
  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt
  // relations: task (SetNull), team (Cascade), project (SetNull), recommendedUser (SetNull),
  // recommendedStudentProfile (SetNull)
}
```

`taskId` is nullable with `onDelete: SetNull` so deleting a task never deletes its allocation history.

---

## 9. Team Workload & Capacity overview (`getTeamWorkloadOverview`)

Per member: `weeklyCapacityHours`, `currentAssignedHours`, `remainingCapacityHours`,
`activeTaskCount`/`maxConcurrentTasks`, an `overloadRisk` (LOW/MEDIUM/HIGH — same utilization +
saturation thresholds as §6, evaluated independently of any specific task), resolved `roleKey`/
`roleLabel`, a `skillCoverageSummary` ("Strong: backend, database; also devops, testing"), and a plain
`recommendationNote` ("At or over capacity — avoid assigning new tasks until load decreases." /
"Approaching capacity — assign smaller or lower-urgency tasks only." / "Good availability for new
tasks."). Rendered on the team page (`app/(dashboard)/dashboard/team/page.tsx`) under "Team Workload &
Capacity". Never shows `privateSupportNotes` or any `CognitiveProfile` field — the section footer
states this explicitly.

---

## 10. UI and API integration

| Surface | What it does |
|---|---|
| `components/tasks/create-task-form.tsx` | Required-skills picker + embedded `TaskAllocationPanel` while creating a task. Applying a recommendation sets the assignee and carries the rationale/score through to `POST /api/tasks`. Editing required skills or manually changing the assignee invalidates the stale recommendation. |
| `components/tasks/task-allocation-panel.tsx` | Shared panel: "Get recommendations" → top 3 candidates with score breakdown, risk badge, current→projected hours, reasons, warnings, and an "Apply"/manual-select choice. |
| `components/tasks/reassign-with-recommendation.tsx` | Task-detail-page control to fetch a fresh recommendation for an *existing* task and apply it via `POST /api/task-allocation/apply`, without re-creating the task. |
| `POST /api/task-allocation/recommend` | Body: `TaskAllocationInput` (teamId, requiredSkills, estimatedMinutes, cognitiveLoad, dueDate, priority). Gate: `canManageTeam` (leader/supervisor/coordinator only). |
| `GET /api/task-allocation/team/[teamId]/overview` | Gate: `canViewTeam`. Students who aren't leaders get the response filtered to their own row only. |
| `POST /api/task-allocation/apply` | Body: `{taskId, userId, studentProfileId?, recommendation?}`. Gate: `canManageTeam`, plus verifies the chosen user is an actual member of the task's team. Updates the `Task` row and writes a `TaskAllocationRecommendation(accepted: true)` row. Fires a `TASK_ASSIGNED` event if the assignee isn't the actor. |

All three routes use `getServerSession(authOptions)` directly (not `requireAuth()`), matching the rest
of `app/api/` — `requireAuth()` redirects on failure, which breaks JSON API error handling.

---

## 11. Permissions

| Role | Can view team overview | Can request recommendations / apply |
|---|---|---|
| Coordinator | Any team | Any team |
| Supervisor | Own teams only (`Team.supervisorId` match) | Own teams only |
| Team leader / co-leader | Own team | Own team |
| Student / member | **Own row only** | No — 403 |

Reuses the existing `canViewTeam`/`canManageTeam` helpers from
[`lib/rbac/team-permissions.ts`](../lib/rbac/team-permissions.ts) — no new permission model was
introduced.

---

## 12. Privacy boundaries

- `CognitiveProfile` is never queried anywhere in `lib/services/tasks/task-allocation.ts` or
  `lib/task-allocation/*`.
- `StudentFormationProfile.privateSupportNotes` is never selected.
- `safeSupportPreferences` is read only to produce the generic hints in §4.6, and only surfaces as
  guidance text, never as a score component that could exclude someone.
- The Team Workload Overview and all allocation API responses expose only operational data: capacity
  hours, task counts, skill *keys* (not levels broken out per skill beyond a short summary string),
  resolved role, and risk level.

---

## 13. What Part 9 will add

Part 8 recommends one task at a time. Part 9's planned conflict/gap dashboard will give the
coordinator a unified, team-wide view across formation conflicts, skill gaps, schedule conflicts, and
(building on this part) persistent overload signals aggregated from `TaskAllocationRecommendation`
history.
