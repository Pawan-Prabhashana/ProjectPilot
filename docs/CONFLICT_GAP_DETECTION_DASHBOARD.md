# Conflict & Gap Detection Dashboard (Part 9)

## Why This Dashboard Matters

The mentor scenario identified a core challenge:
> "flag gaps such as missing critical skills or overlapping commitments."

Coordinators running a capstone programme need a single place to see all major operational and
formation risks — before teams are formed, while teams are being reviewed, and after teams are
published. Without aggregated risk visibility, issues like skill gaps, overloaded students, or
unsubmitted preferences are discovered too late to act on.

The Conflict & Gap Detection Dashboard (`/dashboard/coordinator/conflicts`) aggregates all
deterministic risks into one view, sorted by severity, with recommended actions and direct links
to the relevant pages.

---

## Risk Sources Aggregated

| Source | Description |
|---|---|
| `FORMATION_READINESS` | Student profile completeness, batch state, missing skills/availability/roles |
| `PROJECT_SELECTION` | From Part 4 `ProjectSelectionConflict` records (over-selected, no interest, skill gap, etc.) |
| `DRAFT_FORMATION` | From Part 5 `DraftTeamWarning` records for the latest completed run |
| `PUBLISHED_TEAM` | Operational team gaps (no project, no supervisor, no leader, size violations) |
| `WORKLOAD_TASK` | Student task overload, too many concurrent tasks, unassigned urgent tasks, overdue tasks |
| `SUPERVISOR_CAPACITY` | Supervisor assigned to too many teams, supervisors with no teams |
| `TEAM_HEALTH` | Team health signals (AT_RISK/CRITICAL), unresolved social friction events |

---

## Risk Item Structure

```typescript
type ConflictGapRiskItem = {
  id: string;
  source: RiskSource;
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  recommendedAction: string;
  entityLabel?: string;
  entityType?: 'student' | 'team' | 'topic' | 'task' | 'supervisor' | 'batch' | 'run';
  entityId?: string;
  href?: string;
  metadata?: Record<string, unknown>;
};
```

All items are computed on demand from existing Prisma records — no new schema was required for Part 9.

---

## Severity Model

| Severity | Colour | Examples |
|---|---|---|
| `CRITICAL` | Red | Published team has zero members, CRITICAL draft warning unresolved |
| `HIGH` | Orange | Missing critical skill, no team leader, project over-selection, severe workload overload |
| `MEDIUM` | Amber | Weak role coverage, incomplete profile, overdue tasks, supervisor over-capacity |
| `LOW` | Sky | Draft profile not submitted, few students missing availability |
| `INFO` | Muted | Unassigned supervisors, advisory guidance |

---

## Formation Readiness Risks

Collected by `collectFormationReadinessRisks(termId)`:

- Students in the term with no `StudentFormationProfile` → `HIGH` if 5+, `MEDIUM` if 2+, `LOW` if 1
- Profiles in `DRAFT` or `NEEDS_REVIEW` status → `MEDIUM` if 4+, else `LOW`
- Profiles with `completionScore < 70` → `MEDIUM` if 5+, else `LOW`
- Students with no skills recorded → `MEDIUM` if 3+, else `LOW`
- Students with no availability slots → `MEDIUM` if 3+, else `LOW`
- Students with no role preferences → `LOW`
- No formation batch for the term → `HIGH`
- Formation batch with no included students → `HIGH`

---

## Project Selection Risks

Collected by `collectProjectSelectionRisks(termId)`:

Reads existing `ProjectSelectionConflict` records (Part 4) where `resolved = false`. Maps
`ProjectSelectionConflict.severity` directly to dashboard severity. Includes:
- `OVER_SELECTED` — topic selected by too many students
- `NO_INTEREST` — open topic has zero submitted preferences
- `SKILL_GAP` — interested students lack the topic's required skills
- `STUDENT_MISSING_PREFERENCES` — student in active intake has no submitted preferences
- `CAPACITY_EXCEEDED` — topic's `maxStudents` exceeded

Links to `/dashboard/coordinator/project-topics`.

---

## Draft Formation Warnings

Collected by `collectDraftFormationRisks(termId)`:

Finds the latest `TeamFormationRun` with status `COMPLETED` for the active term. Reads all
`DraftTeamWarning` records for that run where `resolved = false`. Warning types include:
`MISSING_CRITICAL_SKILL`, `WEAK_SKILL_COVERAGE`, `NO_CLEAR_LEADER`, `SCHEDULE_CONFLICT`,
`CAPACITY_IMBALANCE`, `PROJECT_OVER_SELECTED`, `TOPIC_SKILL_GAP`, etc.

If no completed run exists → `MEDIUM` risk flagging that the engine has not been run.

Links to `/dashboard/coordinator/team-formation`.

---

## Published Team Risks

Collected by `collectPublishedTeamRisks(termId)`:

For each `Team` linked to the active term:
- No members → `CRITICAL`
- Below batch `minTeamSize` → `HIGH`
- Above batch `maxTeamSize` → `MEDIUM`
- No linked `Project` → `HIGH`
- No `supervisorId` → `MEDIUM`
- No `LEADER` in `TeamMember.role` → `MEDIUM`
- Was published from a draft that had unresolved HIGH/CRITICAL warnings → `HIGH`

Also includes schedule overlap risks per team (via `collectScheduleOverlapRisks`):
- Fewer than 2 time slots shared by ≥60% of members → `MEDIUM` or `HIGH`

Links to `/dashboard/team-management`.

---

## Workload and Task Risks

Collected by `collectWorkloadTaskRisks(termId)`:

For each team member in each published team:
- `assignedHours > weeklyCapacityHours × 1.5` → `HIGH` (SEVERE_OVERLOAD)
- `assignedHours > weeklyCapacityHours` → `MEDIUM` (OVERLOAD)
- `assignedCount > maxConcurrentTasks` → `MEDIUM` (TOO_MANY_CONCURRENT)

For each published team:
- Unassigned HIGH or URGENT tasks → `HIGH` / `MEDIUM`
- 2+ overdue tasks → `MEDIUM`; 4+ → `HIGH`

Uses `Task.estimatedMinutes` (defaults to 60 min if not set) and
`StudentFormationProfile.weeklyCapacityHours` / `maxConcurrentTasks`.

---

## Supervisor and Team Health Risks

**Supervisor capacity** (`collectSupervisorCapacityRisks`):
- Supervisor with > 4 teams (soft cap) → `MEDIUM`
- Supervisors with no teams assigned → `INFO`

**Team health** (`collectTeamHealthRisks`):
- Latest `TeamHealthSignal.healthStatus` is `AT_RISK` or `CRITICAL` → `HIGH` / `CRITICAL`
- Unresolved `SocialFrictionEvent` records → `MEDIUM` or `HIGH` (based on event severity)

---

## Privacy Boundaries

- `CognitiveProfile` is **never queried** in any part of this service.
- `StudentFormationProfile.privateSupportNotes` is **never read**.
- Only public student names/emails and aggregate counts appear in risk items.
- Friction event descriptions are not surfaced — only counts and safe generic labels.

---

## API

**`GET /api/coordinator/conflicts?termId=...`**

Coordinator-only. Returns `ConflictGapDashboardResult`:
```typescript
{
  term: { id, name, code } | null;
  batch: { id, name, status } | null;
  risks: ConflictGapRiskItem[];   // sorted by severity (CRITICAL first)
  summary: DashboardSummary;
  recommendedActions: RecommendedAction[];
}
```

---

## Dashboard UI Features

- Summary cards: Critical / High / Medium / Total risk counts
- Source breakdown chips (clickable to filter)
- Recommended actions panel with links
- Severity + source filters (client-side)
- Expandable risk cards (title → expand → message + recommended action + link)
- Empty state when no critical/high risks are present

---

## What Part 10 Will Add

| Enhancement | Description |
|---|---|
| End-to-end polish | Notification to students on team publish, resolved conflict tracking |
| Role-to-role gap view | Show which role is missing across all teams at a glance |
| Formation report export | PDF/CSV summary of conflicts and resolutions |
| Coordinator bulk actions | Resolve multiple risks at once (e.g. mark all LOW as reviewed) |
| Risk trend tracking | Persist risk counts over time to show improvement |
