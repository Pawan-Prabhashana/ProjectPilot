# End-to-End Workflow Guide (Part 10)

This document describes the complete connected workflow in ProjectPilot, from student readiness
through team formation to task execution.

---

## Student Workflow

**Entry point:** `/dashboard/my-work`

The student sees their "My Capstone Journey" card at the top of every page visit:

1. **Complete Formation Profile** (`/dashboard/student/formation-profile`)
   - Enter skills, availability, role preferences, weekly capacity
   - Submit profile (moves status from DRAFT → SUBMITTED)
   - 85%+ completion score recommended

2. **Submit Project Preferences** (`/dashboard/student/project-preferences`)
   - Browse open project topics
   - Rank at least 3 preferences
   - Submit (locked once submitted)

3. **Wait for Team Formation**
   - Coordinator reviews preferences and conflicts
   - Coordinator runs the deterministic formation engine
   - Student is notified once teams are published

4. **Review Team and Project** (`/dashboard/team`)
   - See team name, members, supervisor, and linked project
   - Access project brain, contributions, consultations

5. **Check Tasks and Workload** (`/dashboard/tasks`)
   - View assigned tasks
   - See workload summary and cognitive load score
   - Use task decomposition for complex tasks

**Privacy rule:** Students see only their own readiness data, their own team's public data,
and their own task/workload info. No other students' cognitive profiles or support notes.

---

## Coordinator Workflow

**Entry point:** `/dashboard/coordinator`

The coordinator sees the Formation Workflow checklist (8 steps):

| Step | Title | Page |
|------|-------|------|
| 1 | Set up academic term & student intake | Formation Setup |
| 2 | Check student formation profiles | Formation Setup |
| 3 | Open project topics | Project Topics |
| 4 | Review project preferences & conflicts | Project Topics |
| 5 | Run draft team formation | Team Formation |
| 6 | Review draft warnings | Team Formation |
| 7 | Publish teams | Team Formation |
| 8 | Monitor workload & conflicts | Conflict Dashboard |

Each step shows **Done / Ready / Action Needed / Not Started** status with a count or reason and direct link.

**Coordinator page tour:**
- `/dashboard/coordinator/formation-setup` — Term overview, student readiness stats, batch config
- `/dashboard/coordinator/project-topics` — Topic catalogue, demand indicators, conflict cards
- `/dashboard/coordinator/team-formation` — Formation workspace: run engine, review drafts, publish
- `/dashboard/coordinator/conflicts` — Aggregated risk dashboard across all 7 sources

---

## Supervisor Workflow

**Entry point:** `/dashboard/supervisor`

1. View assigned/supervised teams
2. Review team health signals and attention flags
3. Answer open Project Brain questions
4. Manage consultation requests and schedule
5. Review team task progress and workload via Supervisor Workspace
6. Use the Task & Workload action card to check overloaded members

Supervisors **cannot** access coordinator-only pages (formation setup, project topics, team
formation, conflict dashboard). They can view task/workload data for their assigned teams only.

---

## Published Team Workflow

After coordinator publishes teams:
- `Team` record is created with `academicTermId`, `formationBatchId`, `sourceDraftTeamId`
- `TeamMember` records are created with suggested roles (LEADER / CO_LEADER / MEMBER)
- `Project` record is linked to the team
- `StudentIntake.status` → `ASSIGNED_TO_TEAM`
- `FormationBatchStudent.status` → `ASSIGNED`
- Students can now see their team, project, and tasks on `/dashboard/my-work`
- Supervisors can see teams on their dashboard and workspace

---

## Task Allocation Workflow

1. Coordinator or team leader creates a task with `requiredSkills`, `estimatedMinutes`, and priority
2. Call `POST /api/task-allocation/recommend` with `teamId` and task details
3. System scores each member by skill match, role fit, capacity, workload, due date proximity
4. Top candidate is `recommended: true` with an explanation
5. Coordinator applies the recommendation via `POST /api/task-allocation/apply`
6. `Task.assigneeId` is updated and a `TaskAllocationRecommendation` audit record is created

---

## Conflict Dashboard Workflow

The coordinator monitors `/dashboard/coordinator/conflicts` throughout the term:

| Phase | What to check |
|-------|---------------|
| Pre-formation | Formation readiness, missing profiles, project selection conflicts |
| Post-engine | Draft formation warnings, team size violations |
| Post-publish | Published team gaps, workload overload, schedule overlap |
| Ongoing | Team health signals, friction events, supervisor capacity |

---

## Privacy Boundaries

| Data | Who can see it |
|------|----------------|
| `CognitiveProfile` | Student only (own profile) |
| `privateSupportNotes` | Student only |
| Safe support preferences | Used internally for workload routing; generic hints only |
| Student name / email | Own team members (normal operation) |
| Formation profile skills/availability | Coordinator aggregate counts only; no per-student detail |
| Task/workload data | Student (own), supervisor (their teams), coordinator (all teams) |
