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

- A unified **conflict/gap dashboard** — Part 9.

The **deterministic formation engine** (balanced team generation, topic suggestion, skill-gap and
schedule-conflict detection) is implemented in **Part 5** (`docs/TEAM_FORMATION_ENGINE.md`); the
**coordinator workspace + publishing** in **Part 6** (`docs/COORDINATOR_FORMATION_WORKSPACE.md`); the
**role suitability engine** in **Part 7** (`docs/ROLE_SUITABILITY_ENGINE.md`); and **capacity-aware
task allocation** in **Part 8** (`docs/CAPACITY_AWARE_TASK_ALLOCATION.md`).

---

## 5. Requirement Mapping Table

| Mentor Requirement | System Capability (planned target) | Status |
|--------------------|------------------------------------|--------|
| Skill imbalances | Skill inventory and skill coverage scoring | Implemented (draft) — Part 5 skill score + gap warnings |
| Duplicate project selections | Project topic catalogue and preference conflict detection | Implemented — Part 4 |
| Students left without teams | Unassigned student tracking and formation batches | Implemented (draft) — Part 5 places every eligible student; unassigned tracked in run summary |
| Uneven workload distribution | Capacity-aware task allocation | Implemented (draft) — Part 8 recommends task assignees from skill, role, capacity, current load, and due-date feasibility; coordinator/leader confirms before assignment |
| Match by skill | Student skill matrix and role suitability scoring | Implemented (draft) — Part 5 |
| Match by schedule | Structured availability and overlap scoring | Implemented (draft) — Part 5 schedule score + `SCHEDULE_CONFLICT` |
| Match by role suitability | Role catalogue and assignment engine | Implemented (draft) — Part 7 deterministic role suitability engine (13-role catalogue, weighted scoring, coverage + role warnings) |
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

**Stage 7 (Part 7) — Role suitability engine (done):**
Deterministic, explainable role assignment ([`lib/formation/role-suitability.ts`](../lib/formation/role-suitability.ts)).
A 13-role catalogue with weighted scoring (40% skill, 25% preference, 20% confidence, 10% project
relevance, 5% capacity) and a large avoid penalty assigns one primary role per student, covering
critical and topic-driven technical roles first. Stores per-member suitability evidence
(`DraftTeamMember.metadata`) and per-team role coverage (`DraftTeam.metadata.roleCoverage`), recomputes
the team `roleScore`, and raises `MISSING_ROLE_COVERAGE`, `LOW_ROLE_CONFIDENCE`,
`ROLE_AVOIDANCE_CONFLICT`, and `ROLE_SKILL_MISMATCH` warnings. The workspace shows role confidence,
"why this role", and a coverage summary. Publishing is unchanged. See `docs/ROLE_SUITABILITY_ENGINE.md`.

**Stage 8 (Part 8) — Capacity-aware task allocation (done):**
Deterministic, explainable assignee recommendations for tasks
(`lib/services/tasks/task-allocation.ts` with helpers under `lib/task-allocation/`). For a team, scores
every member against a candidate task on six weighted dimensions — skill match (30%), role match (20%,
reusing the Part 7 role catalogue), available capacity (20%), current-load fairness (15%), due-date
feasibility (10%), and support fit (5%, safe preferences only) — and returns a ranked, explained list of
candidates with a LOW/MEDIUM/HIGH risk level. **Recommends and explains — never auto-assigns**; a
human always clicks "Apply" or picks a different assignee manually. Surfaces in the task creation form
and on the task detail page (reassign-with-recommendation), plus a Team Workload & Capacity overview on
the team page (coordinator/supervisor/leader see every member; students see only their own row).
Applying a recommendation stores the rationale and score breakdown on the `Task` row and a
`TaskAllocationRecommendation` audit record. See `docs/CAPACITY_AWARE_TASK_ALLOCATION.md`.

**Stage 9 (Part 9) — Conflict & Gap Detection Dashboard (done):**
A coordinator-facing dashboard (`/dashboard/coordinator/conflicts`) aggregating all operational and
formation risks from 7 sources: formation readiness, project selection conflicts, draft formation
warnings, published team gaps, workload/task risks, supervisor capacity, and team health. Risks are
severity-graded (CRITICAL → INFO), filtered client-side, and linked to the relevant action pages.
Includes recommended actions panel and integration links from the coordinator dashboard, Formation
Setup, and Team Formation workspace. See `docs/CONFLICT_GAP_DETECTION_DASHBOARD.md`.

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

**Stage 10 (Part 10) — End-to-End Workflow Connection (done):**
Student dashboard now shows a "My Capstone Journey" card at the top of `/dashboard/my-work`, guiding
students through Formation Profile → Preferences → Team → Tasks. The coordinator dashboard shows an
8-step Formation Workflow checklist with live status (Done/Ready/Action Needed). Supervisor dashboard
includes a Team Tasks & Workload action card. See `docs/END_TO_END_WORKFLOW.md`.

**Stage 13 (Part 13) — Expanded Demo Dataset (done):**
Seed expanded to 72 students (12 named + 60 bulk), 10 supervisors (3 named + 7 bulk), and 25 project
topics (10 original + 15 new). All 60 bulk students have formation profiles, skills, availability,
role preferences, and project preferences. Conflict scenarios are seeded deterministically. Running
`npm run db:setup` twice produces no duplicates. See `docs/DEMO_SEED_SCENARIOS.md`.
