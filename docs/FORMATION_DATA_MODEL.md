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

### Part 4 — Project Topic Preferences

A project topic catalogue and per-student preference ranking links to `StudentIntake`. The
duplicate-preference detection query groups by `termId` and `topicId`.

### Part 5 — Formation Engine

The engine reads:
- `FormationBatch` (target sizes, status)
- `FormationRuleSet` (weights, required coverage)
- `FormationBatchStudent` (which students are INCLUDED, which are LOCKED)
- Student formation profiles (from Part 3)
- Project preferences (from Part 4)

It writes:
- Team assignments back to `FormationBatchStudent.status = ASSIGNED`
- New `Team` rows with `formationBatchId` set
- Updates `StudentIntake.status` to `ASSIGNED_TO_TEAM`

### Part 6 — Coordinator Formation Workspace

The coordinator can:
- Review proposed teams before publishing.
- Override individual placements (`FormationBatchStudent.locked = true`).
- Approve and publish the batch (`FormationBatch.status = APPROVED → PUBLISHED`).

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
