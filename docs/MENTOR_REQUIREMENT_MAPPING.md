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

- A **project topic catalogue** with preference capture and duplicate-selection detection — Part 4.
- A **formation engine** that uses the skill, availability, role, and capacity data from Part 3 to produce balanced teams — Part 5.
- A **formation engine** that produces balanced teams — Part 5 (the batch/rule-set foundation is now in place).
- **Capacity-aware task allocation** that distributes tasks by each member's capacity — Part 7+.
- **Gap detection** for missing critical skills — Part 5+.
- A **schedule conflict detector** for overlapping commitments — Part 5+.

---

## 5. Requirement Mapping Table

| Mentor Requirement | System Capability (planned target) | Status |
|--------------------|------------------------------------|--------|
| Skill imbalances | Skill inventory and skill coverage scoring | Planned |
| Duplicate project selections | Project topic catalogue and preference conflict detection | Planned |
| Students left without teams | Unassigned student tracking and formation batches | Partial — unassigned tracking + batch/intake models exist; formation engine planned |
| Uneven workload distribution | Capacity-aware task allocation | Partial — workload signals exist; allocation engine planned |
| Match by skill | Student skill matrix and role suitability scoring | Planned |
| Match by schedule | Structured availability and overlap scoring | Planned |
| Match by role suitability | Role catalogue and assignment engine | Planned |
| Missing critical skills | Gap detection warnings | Planned |
| Overlapping commitments | Schedule conflict detector | Planned |
| Neurodivergent support needs | Private support preferences and low cognitive load task guidance | Implemented (private to student) |

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

**Stage 4 (Part 4) — Project topic catalogue (planned):**
Project topic catalogue, student project preference ranking, and duplicate-selection detection.

**Stage 5 (Part 5) — Formation engine (planned):**
Generate balanced teams as formation batches, place every unassigned student, and surface conflicts
(skill gaps, duplicate choices, schedule clashes) for coordinator review and override.

**Stage 6 (Part 6) — Coordinator formation workspace (planned):**
Full formation run UI, override tools, and coordinator approval flow.

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
