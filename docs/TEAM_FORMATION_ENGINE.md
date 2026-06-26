# Team Formation Engine — Part 5

The Team Formation Engine turns the data collected in Parts 2–4 (academic terms, intake batches,
student formation profiles, project topics, and preferences) into **draft** capstone teams with
suggested topics, suggested roles, transparent scores, and warnings — all without any AI/LLM and
without touching the operational `Team` / `TeamMember` / `Project` models.

> **Drafts only.** Everything Part 5 produces is a pre-approval "what-if". Part 6 will add coordinator
> review, manual adjustment, supervisor allocation, approval, and **publishing** drafts into real
> operational teams.

---

## 1. What the deterministic engine does

For a chosen `FormationBatch` it:

1. Loads the eligible students, their formation profiles, project preferences, and the open topics.
2. Calculates how many draft teams to create.
3. Selects a project topic per team from submitted preference demand.
4. Places every eligible student into a team using a deterministic greedy heuristic.
5. Suggests one primary role per student.
6. Computes seven transparent 0–100 scores per team plus a weighted `overallScore`.
7. Raises typed warnings for skill gaps, schedule clashes, capacity imbalance, leadership gaps,
   topic pressure, support-routine mismatches, profile gaps, and team-size issues.
8. Persists the result as a `TeamFormationRun` with `DraftTeam`, `DraftTeamMember`, and
   `DraftTeamWarning` rows, plus a `summary` JSON.

Entry points (`lib/services/formation/team-formation-engine.ts`):

- `runTeamFormationEngine(batchId, createdById?)` — runs the engine and persists a new run.
- `getLatestFormationRun(batchId)` — returns an overview of the most recent run.
- `getFormationRunDetails(runId)` — returns full teams/members/warnings for a run.
- `resolveDefaultBatchId()` — picks the active term's READY (then DRAFT, then most recent) batch.

Helpers live under `lib/formation/`:
`team-formation-options.ts` (constants/weights/role & skill keys), `team-formation-types.ts`
(normalised + result shapes), `team-formation-scoring.ts` (pure scoring functions).

---

## 2. Why it does not use AI for matching decisions

- **Explainability.** A coordinator must be able to justify every placement to students and faculty.
  Each team and member carries a plain-text `explanation` derived from the same numbers shown in the UI.
- **Determinism.** The same batch and data always produce the same teams and scores. There is no
  randomness and no model call. This makes runs reproducible and auditable, and lets the system be
  tested precisely.
- **Fairness & privacy.** Rule-based scoring keeps the matching criteria transparent and bounded, and
  guarantees that sensitive data is never fed into an opaque model. (Privacy boundaries in §4.)

AI/LLM assistance (e.g. natural-language explanations) is explicitly out of scope for Part 5.

---

## 3. What data it reads

Operational data only, for the selected batch and its term:

- `FormationBatch` (+ `FormationRuleSet` weights, `targetTeamSize`/`minTeamSize`/`maxTeamSize`).
- `AcademicTerm`.
- `FormationBatchStudent` → `StudentIntake` → `StudentProfile` → `User` (name/email only).
- `StudentFormationProfile`: `weeklyCapacityHours`, `maxConcurrentTasks`, `completionScore`,
  `status`, `StudentSkill`, `StudentAvailabilitySlot`, `StudentRolePreference`, and the
  **`safeSupportPreferences`** boolean flags.
- `ProjectPreference` (submitted) and `ProjectTopic` (open) for the term.
- `SupervisorProfile` + supervisor `User` name (via the topic) for supervisor-capacity scoring.

---

## 4. Privacy boundaries

The engine enforces the platform's neurodivergent-first privacy rules:

- **`CognitiveProfile` is never queried.** It is not joined anywhere in the engine.
- **`privateSupportNotes` is never selected, stored, or surfaced.** The student-profile query
  explicitly omits it.
- **Only `safeSupportPreferences`** (non-diagnostic work-pattern flags such as
  `prefers_written_instructions`) is read, and only to (a) compute a small support-compatibility score
  and (b) produce **generic** team-routine hints like *"Members prefer written instructions"*,
  *"Team may benefit from predictable meeting times"*, or *"Use clear definitions of done"*.
- **No raw support JSON** and **no diagnosis or neurodivergent labels** ever appear in coordinator-facing
  output. Stored `metadata` contains only the human-readable hint strings, not the raw flags.
- Support compatibility **never penalises an individual** — a low score only suggests the team agree on
  shared working norms.

A run was verified to contain no `privateSupportNotes`, no raw `prefers_*` flags, and no private-note
text anywhere in its persisted output.

---

## 5. How team count is calculated

```
teamCount = max(1, ceil(eligibleStudents.length / batch.targetTeamSize))
```

- If there are **zero** eligible students, the run is marked `FAILED` with a clear `failureReason`.
- The greedy assignment fills teams up to `targetTeamSize` before allowing any team to grow toward
  `maxTeamSize`, which keeps team sizes within one of each other. A `TEAM_SIZE_OUT_OF_RANGE` warning is
  raised if a team ends up below `minTeamSize` or above `maxTeamSize`.

**Eligibility:** a student is eligible when their `FormationBatchStudent.status` is `INCLUDED`,
`ASSIGNED`, or `LOCKED` **and** their `StudentIntake.status` is `READY_FOR_FORMATION` or
`ASSIGNED_TO_TEAM`. (The seed's 12 demo students are `ASSIGNED_TO_TEAM`; Part 5 may still run a draft
"what-if" over them because it never modifies their existing operational teams.) Students with a
missing or unsubmitted profile are still placed, but earn an `INCOMPLETE_STUDENT_PROFILE` warning.

---

## 6. How topic selection works

1. Build per-topic demand from submitted preferences: first-choice count and total count.
2. Consider only topics with demand, ordered by first-choice, then total, then title (deterministic).
3. For each team slot, assign the highest-demand topic still under its `ProjectTopic.maxTeams` cap.
4. If every demanded topic is already at its cap, the highest-demand topic is reused and a
   `DUPLICATE_TOPIC_PRESSURE` warning is raised.
5. After assignment, if a topic's total demand far exceeds the seats actually allocated
   (`> 1.5 ×` capacity), a `PROJECT_OVER_SELECTED` warning is raised.

Teams may legitimately end up with **no** topic if demand runs out; those teams are scored on general
skill balance instead.

---

## 7. How student placement works

A deterministic greedy heuristic:

1. **Normalise** every eligible student (skills, availability weights, role prefs, capacity, safe
   support flags, topic ranks, strong-skill count).
2. **Sort** students by: fewest strong skills first → lowest completion score → email → name → id.
   (Harder-to-place students pick from the best remaining teammates first.)
3. **Create** empty team slots with their pre-selected topics (and the topic's supervisor, if any).
4. For each student, restrict the candidate pool to teams under `targetTeamSize` (then under
   `maxTeamSize`), and pick the team with the best **placement score** — a weighted blend of the same
   skill/schedule/role/preference/capacity/support signals used for final scoring — with a tiny
   smaller-team tie-breaker for balance.
5. Every student is placed; if one cannot be placed cleanly, they go to the least-bad team and the
   relevant warning is raised.

The blend of capacity + schedule + balance keeps teams even rather than piling all strong students
into one team.

---

## 8. The scoring formula

Each team gets seven component scores (0–100) and a weighted `overallScore` (0–100). Weights come from
the batch's `FormationRuleSet`, defaulting to:

| Component | Default weight | What it measures |
|---|---|---|
| `skillScore` | 30 | Coverage of the topic's required (70%) and preferred (30%) skills; or general core-skill balance if no topic. A required skill is *covered* at level ≥ 3, *strong* at ≥ 4. |
| `scheduleScore` | 20 | Shared usable availability slots (≥ ~70% of members AVAILABLE/PREFERRED); ~5 shared slots ⇒ full. |
| `roleScore` | 15 | How many of the 8 canonical roles the team can cover from members' preferences. |
| `preferenceScore` | 15 | Average topic-rank match: rank 1 = 100, 2 = 80, 3 = 60, lower = 40, unranked = 20. |
| `capacityScore` | 10 | Penalises spread in weekly capacity hours (balanced ⇒ high). |
| `supportCompatibilityScore` | 5 | Shared safe work-pattern preferences (basis for team routines). Never penalises individuals. |
| `supervisorCapacityScore` | 5 | Penalises a supervisor linked to too many teams (existing + draft) this run. |

```
overallScore = round( Σ(componentScore × weight) / Σ(weight) )
```

All scores are integers, clamped to 0–100. The breakdown is stored on `DraftTeam` and shown in the UI.

---

## 9. How role suggestions work

Roles come from each student's `StudentRolePreference` (key, label, `preferenceLevel`,
`confidenceLevel`, `avoid`). The 8 canonical roles are: `team_leader`, `frontend_developer`,
`backend_developer`, `database_designer`, `ui_ux_designer`, `qa_tester`, `documentation_lead`,
`presentation_lead`.

The engine walks the roles in fixed order and assigns each to the strongest *willing*, still-unassigned
member (strength = `preferenceLevel × confidenceLevel`, never an `avoid` role unless unavoidable). Any
leftover member receives their strongest non-avoided preference. Each suggestion is stored on
`DraftTeamMember` as `suggestedRoleKey`/`suggestedRoleLabel` with a `roleConfidence` (0–100). If no
member has a strong, non-avoided `team_leader` preference, the team earns a `NO_CLEAR_LEADER` warning.

---

## 10. How warnings are generated

Warnings are `DraftTeamWarning` rows with a `FormationWarningType`, a `FormationWarningSeverity`
(INFO/LOW/MEDIUM/HIGH/CRITICAL), and a title/message. They attach at run, team, student, or topic level:

| Type | Trigger |
|---|---|
| `MISSING_CRITICAL_SKILL` | A topic-required skill is uncovered (no member ≥ 3). |
| `WEAK_SKILL_COVERAGE` | A required skill is covered only at a basic level (no member ≥ 4). |
| `TOPIC_SKILL_GAP` | A team is missing ≥ 2 of its topic's required skills. |
| `NO_CLEAR_LEADER` | No member has a strong, non-avoided `team_leader` preference. |
| `SCHEDULE_CONFLICT` | Fewer than 2 reliably shared availability slots. |
| `CAPACITY_IMBALANCE` | Weekly-capacity spread exceeds the threshold. |
| `PROJECT_OVER_SELECTED` | Topic demand far exceeds allocated seats. |
| `DUPLICATE_TOPIC_PRESSURE` | A topic had to be reused beyond its `maxTeams`. |
| `LOW_PREFERENCE_MATCH` | Team's average preference score is low (< 40). |
| `SUPPORT_COMPATIBILITY_RISK` | Members' safe work-patterns differ with little overlap (routine suggestion only). |
| `SUPERVISOR_CAPACITY_RISK` | A supervisor is linked to more teams than the soft cap. |
| `TEAM_SIZE_OUT_OF_RANGE` | Team size below `minTeamSize` or above `maxTeamSize`. |
| `INCOMPLETE_STUDENT_PROFILE` | A placed student has a missing/unsubmitted formation profile. |
| `STUDENT_UNASSIGNED` | A team ended up empty (placement fallback). |

The run `summary` aggregates `warningCountsBySeverity` and `warningCountsByType`.

---

## 11. What DraftTeam / DraftTeamMember / DraftTeamWarning represent

| Model | Represents | Note |
|---|---|---|
| `TeamFormationRun` | One execution of the engine for a batch | A new run each time; previous runs kept. `status`, `summary`, `settingsSnapshot`. |
| `DraftTeam` | A *suggested* team | Topic, supervisor, name, 7 scores + overall, explanation, support-routine hints. **Not** an operational `Team`. |
| `DraftTeamMember` | A *suggested* placement of a student | Suggested role, role confidence, fit score, explanation. **Not** a `TeamMember`. |
| `DraftTeamWarning` | A gap/conflict flagged for review | Typed + severity-graded; resolvable in Part 6. |

These are pre-approval results. They never create or modify `Team`, `TeamMember`, or `Project`, and
they never change `FormationBatchStudent.status` or `StudentIntake.status`.

---

## 12. What Part 6 added

Part 6 built the full coordinator formation workspace on top of these drafts. It is now live at
`/dashboard/coordinator/team-formation`. Key capabilities:

- **Review** — full run summary, draft team cards with scores, members, warnings, and engine explanations.
- **Filtering** — All / Needs Review / Ready / Has Warnings.
- **Manual adjustment** — rename teams, change status, change member role, move members between teams.
- **Readiness checklist** — per-team validation before publish.
- **Approval & publishing** — transactional conversion of approved drafts into real `Team` / `TeamMember` /
  `Project` records, updating `StudentIntake.status = ASSIGNED_TO_TEAM`, `FormationBatchStudent.status = ASSIGNED`,
  `FormationBatch.status = PUBLISHED`, and `TeamFormationRun.publishedAt / publishedById`.
- **Duplicate publish prevention** — blocked if `Team.sourceDraftTeamId` already exists for any draft team
  in the run, or if `TeamFormationRun.publishedAt` is set.

See `docs/COORDINATOR_FORMATION_WORKSPACE.md` for full documentation.

---

## How to run it (manual test)

1. Log in as the coordinator (`coord@demo.com` / `demo1234`).
2. Open `/dashboard/coordinator/formation-setup` and find **Formation Engine Preview**.
3. Click **Run Draft Formation**. Draft teams appear with topics, members, suggested roles, scores,
   support-routine hints, and warnings. Refresh — the latest run reloads.
4. Students (e.g. `ruvan@demo.com`) cannot run or view the engine: the API returns 403 and the page
   section is coordinator-only.

API (coordinator session required):

- `POST /api/formation-engine/run` — body `{ "batchId"? }`; runs the default batch if omitted.
- `GET  /api/formation-engine/latest?batchId=…` — latest run summary + details.

---

## Related Files

| File | Purpose |
|---|---|
| `lib/services/formation/team-formation-engine.ts` | Run/query service: load, assign, score, warn, persist |
| `lib/formation/team-formation-scoring.ts` | Pure deterministic scoring functions |
| `lib/formation/team-formation-options.ts` | Weights, role/skill keys, thresholds, team names, routine hints |
| `lib/formation/team-formation-types.ts` | Normalised input + result types |
| `app/api/formation-engine/run/route.ts` | Coordinator-only POST to run the engine |
| `app/api/formation-engine/latest/route.ts` | Coordinator-only GET for the latest run |
| `components/formation/formation-engine-preview.tsx` | Coordinator preview UI island |
| `app/(dashboard)/dashboard/coordinator/formation-setup/page.tsx` | Hosts the preview section |
| `prisma/schema.prisma` | `TeamFormationRun`, `DraftTeam`, `DraftTeamMember`, `DraftTeamWarning` + enums |
| `docs/FORMATION_DATA_MODEL.md` | Data-model context for Parts 2–5 |
