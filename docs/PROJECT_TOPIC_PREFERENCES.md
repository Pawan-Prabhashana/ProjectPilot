# Project Topic Preferences — Part 4

## Overview

Part 4 adds the **Project Topic Catalogue** and **Duplicate Project Selection Prevention** layer to ProjectPilot. This allows coordinators to define project topics for a capstone term, students to rank their preferences, and the system to detect demand conflicts before the formation engine runs in Part 5.

---

## 1. ProjectTopic vs Project

| Concept | Model | Purpose |
|---|---|---|
| Pre-formation catalogue item | `ProjectTopic` | Defined by coordinators/supervisors before teams exist. Students select preferences from this catalogue. |
| Operational project | `Project` | Created after team formation or assignment. Linked to a `Team`. Contains tasks, milestones, brain records. |

**ProjectTopic is not Project.** Part 5/6 may later convert or link a `ProjectTopic` to a real `Project`, but they are separate entities. This separation avoids polluting the operational project management layer with pre-formation catalogue items.

---

## 2. How Students Rank Topic Preferences

Students visit `/dashboard/student/project-preferences` and:

1. Browse all **OPEN** topics for the active term.
2. Select topics of interest — each click adds the topic to their ranked list.
3. Reorder preferences by moving topics up or down (rank 1 = top choice).
4. Optionally add a short motivation note for each preference.
5. **Save as draft** before committing — allows editing without losing progress.
6. **Submit** when ready — marks all preferences as `SUBMITTED`.

### Validation
- A student cannot select the same topic twice (duplicate prevention in UI and API).
- Ranks must be unique per student per term (`@@unique([termId, studentProfileId, rank])`).
- Students are encouraged to rank **at least 3 topics** if 3 or more are open.
- After submission, students can re-edit and re-submit before the coordinator closes preferences.

### Privacy
- Students see only their own preferences and cannot see what other students selected.
- The student page shows **no demand counts or conflict data** — those are coordinator-only.

---

## 3. How Duplicate Project Demand Is Detected

The service at `lib/services/formation/project-topics.ts` provides a `recalculateConflicts(termId)` function. This is deterministic and runs without AI.

### Detection logic

| Conflict Type | Trigger | Severity |
|---|---|---|
| `OVER_SELECTED` | First-choice count >> maxTeams, or total interest >> maxTeams × 6 | MEDIUM or HIGH |
| `NO_INTEREST` | OPEN topic has zero submitted preferences | MEDIUM |
| `CAPACITY_EXCEEDED` | Total interested students > topic maxStudents | HIGH |
| `SKILL_GAP` | Fewer than 2 interested students have level ≥ 3 for a required skill | MEDIUM or HIGH |
| `STUDENT_MISSING_PREFERENCES` | StudentIntake is READY_FOR_FORMATION or ASSIGNED_TO_TEAM but has no submitted preferences | LOW |

Conflicts are written to `ProjectSelectionConflict` records. Old unresolved conflicts are cleared before each recalculation to prevent stale data.

---

## 4. How Topic Capacity Works

Each `ProjectTopic` has:

- `minTeams` — minimum number of teams that can take this topic (default 0).
- `maxTeams` — maximum number of teams allowed (default 1).
- `maxStudents` — optional hard cap on total students (across all teams).

If `maxStudents` is set and total submitted interest exceeds it, a `CAPACITY_EXCEEDED` conflict is raised. If demand is very high relative to `maxTeams`, an `OVER_SELECTED` conflict is raised.

---

## 5. How Required Skills Create Early Skill-Gap Warnings

Each `ProjectTopic` stores `requiredSkills` as a JSON array of skill keys (matching Part 3 `StudentSkill.skillKey` values, e.g. `["backend", "database", "ai_ml"]`).

During conflict recalculation, the service:

1. Identifies all students who submitted a preference for this topic.
2. Queries `StudentSkill` records where `level >= 3` for those students.
3. If fewer than 2 interested students have that skill at level ≥ 3, the skill is considered **weak coverage**.
4. A `SKILL_GAP` conflict is created listing all weak skills.

This gives coordinators an early warning that even if a topic has enough demand, the likely team composition may lack critical technical expertise.

---

## 6. How the Coordinator Uses This Before Part 5

The coordinator visits `/dashboard/coordinator/project-topics` to:

1. **Manage the topic catalogue** — create new topics, set status (DRAFT → OPEN → CLOSED).
2. **Review demand** — see first-choice counts and total interest per topic.
3. **Recalculate conflicts** — trigger fresh conflict detection at any time.
4. **Act on conflicts** — adjust topic capacities, promote under-selected topics, or add team slots for high-demand ones.

Before running the Part 5 formation engine, the coordinator should aim to:
- Resolve or acknowledge all CRITICAL/HIGH conflicts.
- Ensure students missing preferences are contacted.
- Confirm topic capacities are realistic for the cohort size.

---

## 7. Privacy Rules

| Data | Who can see it |
|---|---|
| Individual student preference selections | Student themselves only |
| Aggregate demand counts per topic | Coordinator |
| Conflict details (topic-level, no student identity) | Coordinator |
| Conflict with `studentProfileId` (STUDENT_MISSING_PREFERENCES) | Coordinator (operational only — no cognitive data) |
| `CognitiveProfile` data | Never exposed in any project topic or preference page |
| Student private support notes | Never queried in project-topics service |

The `ProjectSelectionConflict` records for `STUDENT_MISSING_PREFERENCES` contain only the `studentProfileId` (a database ID, not personally-identifying on its own). The UI does not expose which specific named student is missing preferences — only the count.

---

## How Part 5 Consumes This Data

The Part 5 formation engine reads **submitted** `ProjectPreference` rows to:

- **Measure topic demand** — first-choice and total counts per topic drive deterministic topic
  selection (high-demand topics are assigned to draft teams first, respecting `ProjectTopic.maxTeams`).
- **Score the preference fit** of each draft team — rank 1 = 100, rank 2 = 80, rank 3 = 60,
  ranked lower = 40, not ranked = 20, averaged across members.
- **Raise warnings** — `PROJECT_OVER_SELECTED` / `DUPLICATE_TOPIC_PRESSURE` when demand exceeds the
  slots that can be allocated, and `LOW_PREFERENCE_MATCH` when a draft team did not rank its assigned
  topic highly.

It also reads `ProjectTopic.requiredSkills` / `preferredSkills` for the team skill score and the
`MISSING_CRITICAL_SKILL` / `WEAK_SKILL_COVERAGE` / `TOPIC_SKILL_GAP` warnings. The Part 4
`ProjectSelectionConflict` records remain a separate, term-level pre-formation signal. See
`docs/TEAM_FORMATION_ENGINE.md`.

---

## Related Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `ProjectTopic`, `ProjectPreference`, `ProjectSelectionConflict` models and enums |
| `lib/services/formation/project-topics.ts` | All queries, mutations, and conflict detection logic |
| `app/api/project-topics/route.ts` | API endpoint for coordinator topic management |
| `app/api/project-preferences/route.ts` | API endpoint for student preference save/submit |
| `app/(dashboard)/dashboard/coordinator/project-topics/page.tsx` | Coordinator topic catalogue and conflict UI |
| `app/(dashboard)/dashboard/student/project-preferences/page.tsx` | Student preference selection UI |
| `app/(dashboard)/dashboard/coordinator/formation-setup/page.tsx` | Updated with project preference readiness section |
| `docs/FORMATION_DATA_MODEL.md` | Updated to include Part 4 models |
