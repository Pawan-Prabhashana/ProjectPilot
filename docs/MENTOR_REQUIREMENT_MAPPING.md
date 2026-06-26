# Mentor Requirement Mapping

This document maps the mentor's **student project team formation & task allocation** scenario to the
current ProjectPilot system and the planned staged roadmap. It is the source of truth for how the
product direction connects to what is built today and what comes next.

---

## 1. Mentor Scenario Summary

A faculty member running a capstone programme manually forms hundreds of students into project teams
each semester. The manual process causes:

- **Skill imbalances** between teams.
- **Duplicate project selections** that go unnoticed.
- **Students left without teams.**
- **Uneven workload distribution** once teams are formed.

There is currently **no mechanism** to match individuals by skill, schedule, or role suitability. The
faculty needs a system that can:

1. Form balanced teams intelligently.
2. Assign roles based on skills.
3. Distribute tasks according to each member's capacity.
4. Flag gaps such as missing critical skills or overlapping commitments.

ProjectPilot is being repositioned as an **intelligent capstone team formation and task allocation
platform**, while keeping **neurodivergent-first support** as a strong, private differentiator.

---

## 2. Current System Status

ProjectPilot already provides a stable operational foundation for capstone coordination:

- **Role-based access** for Students, Supervisors, and Coordinators (enforced server-side).
- **Teams, projects, milestones, tasks, and contributions** modelled in Prisma + PostgreSQL.
- **Coordinator dashboard** with platform-wide counts, setup health scoring, unassigned-student
  tracking, and team setup gap detection.
- **Team & Supervisor management** operational overviews (read-oriented) that surface coverage gaps.
- **Team health monitoring** (deterministic, explainable signals).
- **Supervisor consultation** scheduling, briefs, and feedback translation.
- **Neurodivergent-first support toolkit** (focus mode, low-energy mode, communication translator,
  social signal decoder, cognitive profile) — kept **private to each student**.

The **intelligent formation engine itself is not yet implemented.** The current system provides the
operational data and signals that the formation engine will consume.

---

## 3. What Already Exists

| Capability | Where |
|------------|-------|
| Role-based dashboards & access control | `lib/rbac/`, `middleware.ts`, per-page `requireAuth` checks |
| Teams, members, leaders | `prisma/schema.prisma` (`Team`, `TeamMember`) |
| Projects, milestones, tasks | `prisma/schema.prisma` (`Project`, `Milestone`, `Task`) |
| Unassigned student tracking | `lib/services/dashboard/coordinator-dashboard.ts` (`studentsWithoutTeam`) |
| Team setup gap detection | `lib/services/dashboard/coordinator-dashboard.ts` (`setupGaps`) |
| Supervisor capacity overview | `app/(dashboard)/dashboard/supervisor-management/page.tsx` |
| Team health signals | `lib/metrics/health.ts` |
| Workload fairness signals | `lib/metrics/workload.ts`, `lib/metrics/summaries.ts` |
| Task risk / overdue / unassigned task tracking | `lib/metrics/summaries.ts` (`getTaskRiskSummary`) |
| Consultation scheduling & briefs | `lib/services/consultation-readiness.ts`, `supervisor-bridge.ts` |
| Neurodivergent support tools (private) | `app/(dashboard)/dashboard/support-tools/`, `lib/services/cognitive-support.ts` |

---

## 4. What Is Missing

These are **planned next modules**, not implemented yet:

- A **coordinator formation workspace** to review, manually adjust, approve, and publish draft teams into real operational teams — Part 6.
- **Capacity-aware task allocation** that distributes tasks by each member's capacity — Part 7+.

The **deterministic formation engine** (balanced team generation, topic/role suggestion,
skill-gap and schedule-conflict detection) is now implemented as **Part 5** — see
`docs/TEAM_FORMATION_ENGINE.md`. It produces **draft** results only; nothing is published yet.

---

## 5. Requirement Mapping Table

| Mentor Requirement | System Capability (planned target) | Status |
|--------------------|------------------------------------|--------|
| Skill imbalances | Skill inventory and skill coverage scoring | Implemented (draft) — Part 5 skill score + gap warnings |
| Duplicate project selections | Project topic catalogue and preference conflict detection | Implemented — Part 4 |
| Students left without teams | Unassigned student tracking and formation batches | Implemented (draft) — Part 5 places every eligible student; unassigned tracked in run summary |
| Uneven workload distribution | Capacity-aware task allocation | Partial — Part 5 balances team capacity; task-level allocation is Part 7+ |
| Match by skill | Student skill matrix and role suitability scoring | Implemented (draft) — Part 5 |
| Match by schedule | Structured availability and overlap scoring | Implemented (draft) — Part 5 schedule score + `SCHEDULE_CONFLICT` |
| Match by role suitability | Role catalogue and assignment engine | Implemented (draft) — Part 5 suggests one primary role per student |
| Missing critical skills | Gap detection warnings | Implemented (draft) — Part 5 `MISSING_CRITICAL_SKILL` / `WEAK_SKILL_COVERAGE` / `TOPIC_SKILL_GAP` |
| Overlapping commitments | Schedule conflict detector | Implemented (draft) — Part 5 `SCHEDULE_CONFLICT` |
| Neurodivergent support needs | Private support preferences and low cognitive load task guidance | Implemented (private to student); Part 5 uses only safe routine signals |

---

## 6. Planned Staged Implementation Roadmap

**Stage 0 — Foundation stabilisation (done):**
Lint/build clean, naming fixes, product reframing, coordinator/team/supervisor overviews, this mapping.

**Stage 1 (Part 1) — Product reframing (done):**
Landing page, README, dashboard copy, and documentation updated to reflect the intelligent capstone
team formation direction. Neurodivergent-first support repositioned as a private differentiator layer.

**Stage 2 (Part 2) — Academic term & intake foundation (done):**
`AcademicTerm`, `StudentIntake`, `FormationBatch`, `FormationBatchStudent`, and `FormationRuleSet`
models added to the schema. Seed data creates a demo active term, formation batch, rule set, and
intake rows for all demo students. Coordinator Formation Setup page added at
`/dashboard/coordinator/formation-setup`. No matching algorithm yet.

**Stage 3 (Part 3) — Student formation profile (done):**
`StudentFormationProfile`, `StudentSkill`, `StudentAvailabilitySlot`, and `StudentRolePreference`
models added to the schema. Covers skill inventory (level + interest per skill), weekly capacity,
max concurrent tasks, schedule availability grid (7 days × 4 blocks), role preferences with
confidence and avoidance flags, domain preferences, and safe support preferences (non-diagnostic
style signals). Private support notes field is student-only and never queried in coordinator or
supervisor services. Student Formation Profile page at `/dashboard/student/formation-profile`.
Coordinator Formation Setup page updated with aggregate profile readiness counts (submitted, draft,
no profile, average score, no-skills count). Seed data creates submitted profiles for all 12 demo
students with varied, realistic data.

**Stage 4 (Part 4) — Project topic catalogue (done):**
`ProjectTopic`, `ProjectPreference`, and `ProjectSelectionConflict` models added to the schema.
Coordinator can manage topics at `/dashboard/coordinator/project-topics` — create topics, view
demand counts (first-choice and total interest per topic), and recalculate selection conflicts.
Conflicts detected: `OVER_SELECTED`, `NO_INTEREST`, `CAPACITY_EXCEEDED`, `SKILL_GAP`, and
`STUDENT_MISSING_PREFERENCES`. Student project preferences page at
`/dashboard/student/project-preferences` — browse OPEN topics, rank preferences, save draft, submit.
Duplicate topic selection is prevented at both the UI and API level. Coordinator Formation Setup
updated with project preference readiness summary (open topics, submitted sets, missing preferences,
unresolved conflicts). Seed data creates 10 demo topics, 12 student preference sets, and
pre-calculated conflict records demonstrating OVER_SELECTED, NO_INTEREST, and SKILL_GAP scenarios.

**Stage 5 (Part 5) — Formation engine (done):**
Deterministic, explainable team-formation engine (`lib/services/formation/team-formation-engine.ts`
with helpers under `lib/formation/`). For a formation batch it loads eligible students, calculates a
draft team count from `targetTeamSize`, suggests a project topic per team from submitted preference
demand, places every student with a deterministic greedy heuristic, suggests one primary role per
student, computes seven transparent 0–100 scores (skill, schedule, role, preference, capacity,
support compatibility, supervisor capacity) weighted by `FormationRuleSet`, and raises typed warnings
(`FormationWarningType`) for gaps and conflicts. Results persist as `TeamFormationRun`, `DraftTeam`,
`DraftTeamMember`, and `DraftTeamWarning` — **drafts only**, never operational `Team`/`Project` rows.
Coordinator-only API at `/api/formation-engine/run` and `/api/formation-engine/latest`, plus a
"Formation Engine Preview" section on the Formation Setup page. No AI/LLM is used: same input ⇒ same
output. See `docs/TEAM_FORMATION_ENGINE.md`.

**Stage 6 (Part 6) — Coordinator formation workspace (done):**
Full formation run UI, manual adjustment controls (rename team, change status, change member role,
move member between teams), a readiness checklist, and a coordinator approval flow that **publishes**
approved drafts into real `Team`/`TeamMember`/`Project` records. Updates `StudentIntake`,
`FormationBatchStudent`, `FormationBatch.status → PUBLISHED`, and `TeamFormationRun.publishedAt`.
Duplicate publishing is blocked. Route: `/dashboard/coordinator/team-formation`.
See `docs/COORDINATOR_FORMATION_WORKSPACE.md`.

**Stage 7 (Part 7+) — Allocation & oversight (planned):**
Capacity-aware task allocation, capacity-aware supervisor allocation, and ongoing team-health-driven
rebalancing — all visible to coordinators and supervisors as operational signals.

Throughout every stage, the neurodivergent support layer is used only as **safe, private support
preferences** that shape a student's own experience (clearer tasks, manageable workload), never as a
matching or ranking input exposed to coordinators or supervisors.

---

## 7. Privacy Note

Neurodivergent / cognitive support data is **private to the student**:

- `CognitiveProfile` and accessibility settings are **never** included in coordinator or supervisor
  queries or dashboards.
- This data must only be used as **safe support preferences** that improve the student's own
  experience (e.g. lower cognitive load task guidance, clearer communication).
- It must **not** be exposed directly to coordinators or supervisors, and it must **not** be used as a
  visible factor in team formation, ranking, or role assignment.
- Coordinator and supervisor views show **operational data only** (counts, setup gaps, team health,
  capacity), consistent with data minimisation and purpose limitation principles.
