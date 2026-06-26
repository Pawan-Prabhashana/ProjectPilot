# Student Formation Profile — Part 3 Documentation

## Overview

The Student Formation Profile is the student-side data collection layer introduced in Part 3. It captures the information needed to intelligently match students into balanced capstone project teams. Students fill in their own profile voluntarily through the Formation Profile page (`/dashboard/student/formation-profile`).

---

## What the Profile Collects

### 1. Weekly Capacity
- **weeklyCapacityHours** (1–40): How many hours per week the student realistically has available for the project.
- **maxConcurrentTasks** (1–10): The maximum number of tasks the student can focus on simultaneously.
- **preferredTeamSize** (optional): Whether the student has a preference for small or larger teams.

**Why it matters:** Used in Part 8 (capacity-aware task allocation) to distribute work fairly and prevent individual overload.

---

### 2. Skills (StudentSkill)
Each skill entry records:
- **skillKey / skillLabel**: Identifies the skill (e.g. `frontend` / "Frontend Development")
- **category**: Groups skills (Technical, Design, Quality, Research, Communication, Management)
- **level** (1–5): Self-assessed proficiency
- **interest** (1–5): How much the student enjoys this skill area
- **source**: How the skill was established (self-assessed, coursework, project experience, supervisor-verified)
- **evidence** (optional): Free-text supporting detail

Predefined skills in Part 3: `frontend`, `backend`, `database`, `ui_ux`, `testing`, `documentation`, `research`, `presentation`, `project_management`, `ai_ml`, `mobile_development`, `devops`

**Why it matters:** Used in Part 5 (formation engine) for **skill coverage scoring** — ensuring each team has sufficient coverage across required roles and no critical skills are missing.

---

### 3. Role Preferences (StudentRolePreference)
Each role preference entry records:
- **roleKey / roleLabel**: The team role (e.g. `team_leader`, `frontend_developer`)
- **preferenceLevel** (1–5): How much the student wants this role
- **confidenceLevel** (1–5): How confident they are in performing this role
- **avoid** (boolean): Whether the student explicitly does not want this role

Predefined roles: `team_leader`, `frontend_developer`, `backend_developer`, `database_designer`, `ui_ux_designer`, `qa_tester`, `documentation_lead`, `research_lead`, `presentation_lead`, `client_communication_lead`

**Why it matters:** Used in Part 5 for **role suitability scoring** — matching students to roles that align with both their preference and confidence, while respecting explicit avoidance flags.

---

### 4. Schedule Availability (StudentAvailabilitySlot)
Each slot records:
- **dayOfWeek** (MONDAY–SUNDAY)
- **block** (MORNING / AFTERNOON / EVENING / NIGHT)
- **level**: PREFERRED / AVAILABLE / LIMITED / UNAVAILABLE

**Why it matters:** Used in Part 5 for **schedule overlap scoring** — ensuring teams can realistically meet and collaborate without forcing incompatible schedules.

---

### 5. Domain Preferences (JSON)
A list of project domain areas the student is interested in (e.g. "AI / ML", "Web application", "Healthcare technology").

**Why it matters:** Feeds into Part 4 (project topic preferences) and Part 5 formation scoring — students are not forced into projects they find uninteresting.

---

### 6. Safe Support Preferences (JSON)
A set of boolean flags representing non-diagnostic support style signals:

| Key | Meaning |
|-----|---------|
| `prefers_async_communication` | Prefer chat/written notes over live calls |
| `prefers_written_instructions` | Written briefs are clearer than verbal |
| `prefers_clear_definition_of_done` | Needs explicit completion criteria |
| `prefers_smaller_task_chunks` | Works better with well-scoped smaller tasks |
| `prefers_predictable_meeting_times` | Consistent scheduled meetings preferred |
| `prefers_reduced_meeting_load` | Fewer or shorter meetings preferred |
| `prefers_visual_task_board` | Kanban-style boards help |
| `prefers_advance_notice_before_changes` | Early notice of scope/schedule changes |
| `prefers_low_pressure_presentations` | Less formal presentation formats preferred |
| `prefers_regular_progress_checkpoints` | Regular brief check-ins preferred |

**Why it matters:** Used in Part 5 for **support compatibility scoring** — grouping students whose working styles are likely to be compatible. Also feeds into Part 8 task guidance (structuring tasks to match declared preferences).

**Privacy:** These are anonymous style signals, not diagnosis labels. They are never shown to coordinators or supervisors in individual, identifiable form. Coordinators see only aggregate readiness counts.

---

### 7. Private Support Notes (Text)
Free-text field visible only to the student themselves. Examples: work style details, context about focus preferences, notes about ideal team dynamics.

**Privacy:** STRICTLY PRIVATE. Never queried in any coordinator, supervisor, or formation engine service. Enforced at the service layer — `privateSupportNotes` is excluded from all non-student queries.

---

## Completion Score

The profile has a computed `completionScore` (0–100) calculated server-side, never trusted from the client:

| Section | Points |
|---------|--------|
| Capacity set (non-default weekly hours) | 10 |
| At least 3 skills recorded | 25 |
| At least 1 role preference recorded | 20 |
| At least 6 availability slots recorded | 20 |
| Domain preferences selected | 10 |
| Support preferences set | 15 |
| **Total** | **100** |

---

## Profile Status Flow

```
DRAFT → SUBMITTED → (NEEDS_REVIEW if flagged)
```

- **DRAFT**: Default on creation. Student is editing but has not marked as ready.
- **SUBMITTED**: Student has marked the profile as ready for formation. `submittedAt` is recorded and `StudentIntake.status` is automatically upgraded from `PROFILE_PENDING` → `READY_FOR_FORMATION` (unless already `ASSIGNED_TO_TEAM`).
- **NEEDS_REVIEW**: Reserved for Part 5 — flagged by the formation engine if profile data is incomplete for matching.

---

## What Each Part Builds on This

| Part | What it Uses |
|------|-------------|
| **Part 4** — Project Topic Preferences (done) | Skills used in SKILL_GAP conflict detection for interested topics; Domain preferences inform project interest; Student profiles are queried in `recalculateConflicts` to check skill coverage |
| **Part 5** — Formation Engine | Skills → skill coverage scoring; Availability → schedule overlap scoring; Roles → role suitability scoring; Capacity → capacity balance scoring; Support preferences → support compatibility scoring |
| **Part 6** — Coordinator Formation Workspace | Aggregate profile readiness counts per batch |
| **Part 8** — Task Allocation Engine | Weekly capacity hours + max concurrent tasks for fair work distribution; support preferences for task structuring guidance |

---

## Privacy Rules (Summary)

| Data | Who can see it |
|------|---------------|
| Skills, roles, availability, domains | Formation engine (aggregate/anonymous in matching), student UI |
| `safeSupportPreferences` | Student UI; used anonymously in formation compatibility scoring |
| `privateSupportNotes` | **Student only** — NEVER queried elsewhere |
| `CognitiveProfile` | **Student only** — never queried in any formation service |
| Coordinator aggregate readiness | Count of submitted/draft/no-profile only; no individual data |

---

## Related Files

- Schema: `prisma/schema.prisma` — `StudentFormationProfile`, `StudentSkill`, `StudentAvailabilitySlot`, `StudentRolePreference`
- Service: `lib/services/formation/student-profile.ts`
- API route: `app/api/formation-profile/route.ts`
- Student UI: `app/(dashboard)/dashboard/student/formation-profile/page.tsx`
- Coordinator visibility: `app/(dashboard)/dashboard/coordinator/formation-setup/page.tsx`
- Related: `docs/FORMATION_DATA_MODEL.md`, `docs/MENTOR_REQUIREMENT_MAPPING.md`
