# Formation Data Model

This document explains the academic term / intake / batch / rule-set models added in Part 2,
how they relate to each other and to existing Team records, and what they enable for later parts.

---

## 1. Why These Models Are Needed

The mentor scenario requires that a faculty coordinator can:

1. Define an academic semester (when formation is happening).
2. Register which students are in that semester's cohort (who will be formed).
3. Configure a formation run with target team sizes and algorithm weights (how teams will be formed).
4. Track each student's progress through the pipeline (invited → ready → assigned).
5. Link completed teams back to the term and batch that produced them.

Without these models the system has no concept of *when* and *for whom* a formation run is being
performed. They are the administrative scaffolding that all later formation intelligence builds on.

---

## 2. Model Relationships

```
AcademicTerm
│
├── StudentIntake[]          (one per student per term)
│     └── FormationBatchStudent[]   (bridges to batches)
│
├── FormationBatch[]         (one or more runs per term)
│     ├── FormationBatchStudent[]   (students in this run)
│     ├── FormationRuleSet          (one rule set per batch)
│     └── Team[]                   (teams produced by this batch)
│
└── Team[]                   (teams that carry academicTermId)
```

### AcademicTerm

The top-level scope. One row per semester/year. Multiple batches and many student intakes can
belong to the same term.

Fields of note:
- `code` — unique, slug-like identifier (e.g. `2026-S1-CAPSTONE`).
- `status` — `PLANNED | ACTIVE | COMPLETED | ARCHIVED`. Only ACTIVE terms appear on the
  Formation Setup page.
- `startsAt` / `endsAt` — optional date bounds for the semester.

### StudentIntake

One row per student per term. Tracks where that student is in the formation pipeline for that
specific semester. Students may appear in multiple terms if the system is used across years.

Fields of note:
- `status` — `INVITED | PROFILE_PENDING | READY_FOR_FORMATION | ASSIGNED_TO_TEAM | WITHDRAWN`.
- `programme`, `cohortLabel` — academic classification metadata (non-sensitive).
- `source` — how the student was added (`manual`, `import`, etc.).
- Unique constraint: `[termId, studentProfileId]` prevents duplicate intake rows.

### FormationBatch

A formation run. Multiple batches can exist per term (e.g. main cohort, late additions, re-runs).

Fields of note:
- `status` — `DRAFT | READY | RUNNING | REVIEW | APPROVED | PUBLISHED | ARCHIVED`.
- `targetTeamSize`, `minTeamSize`, `maxTeamSize` — the team-size envelope for this run.
- `createdById` — the coordinator who created this batch (nullable, SetNull on user delete).

### FormationBatchStudent

The join table between a batch and a student intake. Carries per-student override data for
a specific run.

Fields of note:
- `status` — `INCLUDED | EXCLUDED | LOCKED | ASSIGNED`.
- `locked` — if true, the coordinator has manually fixed this student's placement.
- `exclusionReason` — why a student was excluded (coordinator note).
- Unique constraint: `[batchId, studentIntakeId]` prevents double-adding a student.

### FormationRuleSet

Configuration for the formation algorithm. One rule set per batch (`batchId @unique`).

Weight fields are integers; the algorithm normalises them at runtime (divides by total weight).
This allows coordinators to adjust priorities without knowing percentages:

| Weight field | What it prioritises |
|---|---|
| `skillWeight` | Balanced skill coverage across teams |
| `scheduleWeight` | Overlapping availability between team members |
| `roleWeight` | Role suitability match (backend, frontend, UX, etc.) |
| `preferenceWeight` | Student project topic preferences |
| `capacityWeight` | Balanced workload / credit load |
| `supportCompatibilityWeight` | Safe, private support preferences (see privacy note) |
| `supervisorCapacityWeight` | Supervisor team-load balance |

`requiredCoverage` is a JSON field for specifying mandatory roles or skills that every team
must contain (e.g. at least one backend and one frontend student per team).

---

## 3. Team ↔ Formation Links

The existing `Team` model has two new optional fields:

- `academicTermId` — which term this team was formed in.
- `formationBatchId` — which specific batch produced this team.

Both are nullable (SetNull on cascade) so existing teams without formation context remain valid.
Adding these fields allows coordinators and the formation engine to:

- See which teams belong to the current semester.
- Trace each team back to the formation run that created it.
- Compute per-batch coverage statistics (how many teams were produced, what was the average size, etc.).

---

## 4. What This Enables for Later Parts

### Part 3 — Student Formation Profile (done)

Part 3 added `StudentFormationProfile` linked to `StudentProfile` (via `@@unique studentProfileId`):

- **`StudentSkill`** — skill inventory with level (1–5), interest (1–5), category, and source
- **`StudentAvailabilitySlot`** — weekly schedule grid (7 days × 4 blocks) with availability level
- **`StudentRolePreference`** — per-role preference, confidence, and avoid flags
- **`StudentFormationProfile`** — base profile with capacity, domain preferences, safe support preferences (non-diagnostic), and private notes (student-only)

The profile has a computed `completionScore` (0–100) calculated server-side.
When submitted, `StudentIntake.status` is automatically upgraded from `PROFILE_PENDING` to `READY_FOR_FORMATION`.

The coordinator Formation Setup page now shows aggregate profile readiness counts without exposing any individual student data or private notes.

### Part 4 — Project Topic Preferences (done)

Three new models:

- **`ProjectTopic`** — a coordinator-defined capstone project topic for a term. Distinct from the operational `Project` model. Includes title, slug, domain, difficulty, status, team slots, capacity limits, `requiredSkills` and `preferredSkills` JSON arrays.
- **`ProjectPreference`** — a student's ranked selection of a topic (rank 1 = top choice). Unique per student per topic per term. Saved as DRAFT then SUBMITTED.
- **`ProjectSelectionConflict`** — a detected demand imbalance. Types: `OVER_SELECTED`, `NO_INTEREST`, `CAPACITY_EXCEEDED`, `SKILL_GAP`, `STUDENT_MISSING_PREFERENCES`. Deterministically recalculated by the conflict service.

The coordinator topic page at `/dashboard/coordinator/project-topics` shows demand counts (per topic) and conflict cards. The student page at `/dashboard/student/project-preferences` shows only OPEN topics and the student's own ranked selections — no demand counts are exposed to students.

Existing models updated:
- `AcademicTerm` — added `projectTopics`, `projectPreferences`, `projectSelectionConflicts` relations.
- `StudentProfile` — added `projectPreferences`, `projectSelectionConflicts` relations.
- `SupervisorProfile` — added `projectTopics` relation.
- `User` — added `createdProjectTopics` relation (named `ProjectTopicCreator`).

### Part 5 — Formation Engine (draft results)

Part 5 adds the deterministic team-formation engine and four **draft-result** models. These are
pre-approval "what-if" outputs only — the engine never touches operational `Team`/`TeamMember`/
`Project` rows and never changes `FormationBatchStudent.status` or `StudentIntake.status`. Part 6
will publish approved drafts into real teams.

New models (see `prisma/schema.prisma`, "PART 5" sections):

- **`TeamFormationRun`** — one execution of the engine for a batch. Tracks `status`
  (`TeamFormationRunStatus`: QUEUED/RUNNING/COMPLETED/FAILED/ARCHIVED), `algorithmVersion`
  (`deterministic-v1`), `settingsSnapshot` (weights + sizes), and a `summary` JSON
  (totals, average score, unassigned count, warning counts by type/severity, topic usage). A new run
  is created every time; previous runs are kept.
- **`DraftTeam`** — a suggested team within a run. Holds the suggested `topicId`/`supervisorProfileId`,
  a deterministic name (Draft Team Alpha, Beta, …), `status` (`DraftTeamStatus`), and seven
  transparent 0–100 scores plus `overallScore` (weighted), an `explanation`, and `metadata`
  (member count, generic support-routine hints, topic slug).
- **`DraftTeamMember`** — a suggested placement of a student into a draft team, with `suggestedRoleKey`/
  `suggestedRoleLabel`, `roleConfidence`, `fitScore`, and an `explanation`. Unique per `(runId,
  studentProfileId)` and `(draftTeamId, studentProfileId)`.
- **`DraftTeamWarning`** — a typed warning (`FormationWarningType`) at run/team/student/topic level with
  a `FormationWarningSeverity`, title, message, and metadata.

The engine reads only operational data: `FormationBatch` + `FormationRuleSet`, `AcademicTerm`,
`FormationBatchStudent` (INCLUDED/ASSIGNED/LOCKED) joined to `StudentIntake`
(READY_FOR_FORMATION/ASSIGNED_TO_TEAM), Part 3 formation profiles (skills, availability, role
preferences, capacity, and the safe `safeSupportPreferences` flags only), Part 4
`ProjectPreference`/`ProjectTopic`, and `SupervisorProfile` basics. It never reads `CognitiveProfile`
or `privateSupportNotes`. Full detail in `docs/TEAM_FORMATION_ENGINE.md`.

Existing models updated for Part 5 (new relations only):
- `AcademicTerm` — `teamFormationRuns`, `draftTeams`
- `FormationBatch` — `teamFormationRuns`, `draftTeams`
- `User` — `createdTeamFormationRuns` (named `TeamFormationRunCreator`)
- `ProjectTopic` — `draftTeams`, `draftTeamWarnings`
- `SupervisorProfile` — `draftTeams`
- `StudentProfile` — `draftTeamMemberships`, `draftTeamWarnings`
- `StudentIntake` — `draftTeamMemberships`

### Part 6 — Coordinator Formation Workspace (done)

The coordinator can:
- Review draft teams, scores, warnings, and engine explanations.
- Rename draft teams, change their status (`DRAFT → NEEDS_REVIEW → READY → LOCKED`).
- Change a member's suggested role key and label.
- Move a member from one draft team to another within the same run.
- Run a readiness validation checklist before publishing.
- Publish an approved run into real `Team`, `TeamMember`, and `Project` records.

**Schema additions (Part 6):**
- `TeamFormationRun.publishedAt DateTime?`
- `TeamFormationRun.publishedById String?` → `User` (named relation `"TeamFormationRunPublisher"`)
- `TeamFormationRun.publishSummary Json?`
- `Team.sourceDraftTeamId String? @unique` → `DraftTeam` (named relation `"DraftTeamPublishedTeam"`)
- `DraftTeam.publishedTeam Team?` (inverse relation)

Publishing is transactional. Duplicate publishing is blocked. `FormationBatch.status` is updated to
`PUBLISHED`. `StudentIntake.status` and `FormationBatchStudent.status` are updated to `ASSIGNED_TO_TEAM`
and `ASSIGNED` respectively.

See `docs/COORDINATOR_FORMATION_WORKSPACE.md` for full details.

### Part 7 — Role Suitability Engine (done)

Part 7 deepens role assignment without new tables — it reuses existing fields:

- **`DraftTeamMember`**: `suggestedRoleKey` / `suggestedRoleLabel` now come from the 13-role
  suitability catalogue; `roleConfidence` holds the 0–100 suitability score; `explanation` holds the
  "why this role" reason; and `metadata` stores non-sensitive evidence (`roleSuitabilityScore`,
  `roleSuitabilityBreakdown`, `matchedSkills`, `weakSkills`, `avoidedRole`, `assignmentReason`).
- **`DraftTeam`**: `roleScore` is recomputed from role coverage + average suitability + key-role
  coverage; `metadata.roleCoverage` stores `requiredRoles` / `coveredRoles` / `missingRoles` /
  `weakRoles` / `roleCoverageScore` / `roleAssignmentVersion: "role-suitability-v1"`.

**Schema additions (Part 7):** only four new `FormationWarningType` enum values —
`MISSING_ROLE_COVERAGE`, `LOW_ROLE_CONFIDENCE`, `ROLE_AVOIDANCE_CONFLICT`, `ROLE_SKILL_MISMATCH`. No
new models or columns. Publishing (Part 6) is unchanged: `team_leader → LEADER`,
`co_leader → CO_LEADER`, else `MEMBER`.

See `docs/ROLE_SUITABILITY_ENGINE.md` for the catalogue, formula, and warnings.

---

## 5. Privacy Note

**CognitiveProfile is strictly private and is never queried by formation models or pages.**

The `supportCompatibilityWeight` field in `FormationRuleSet` is intentionally kept low (default 5
out of 100 total). It is used only as a **safe, private support signal** — for example, ensuring
that a student who prefers structured communication is not placed in a team where the only other
members prefer minimal interaction. It does **not** expose raw cognitive profile fields (overload
sensitivity, support mode, ambiguity comfort, etc.) to coordinators, supervisors, or the formation
output.

Concretely:
- Formation setup pages (`/dashboard/coordinator/formation-setup`) query only `AcademicTerm`,
  `StudentIntake`, `FormationBatch`, `FormationBatchStudent`, `Team`, and safe `User`/`StudentProfile`
  fields. They never include a `CognitiveProfile` join.
- The formation service (`lib/services/formation/setup.ts`) has an explicit privacy comment
  at the top and no `cognitiveProfile` query anywhere.
- When Part 5 implements the algorithm, the support compatibility signal must be derived from an
  aggregated, anonymised compatibility score — not from raw sensitive fields.
