# Role Suitability Engine — Part 7

Part 7 upgrades the formation engine's role logic from a simple "best preference" guess into a
deterministic, explainable **role suitability** engine. For every draft team member it assigns a
more accurate primary role, explains *why*, flags missing/weak/avoided role coverage, and feeds an
improved team `roleScore`. It improves **role assignment only** — team creation, placement, topic
selection, and publishing are unchanged.

> No AI. Same inputs ⇒ same outputs. The engine lives in
> [`lib/formation/role-suitability.ts`](../lib/formation/role-suitability.ts) and is invoked by the
> formation engine ([`lib/services/formation/team-formation-engine.ts`](../lib/services/formation/team-formation-engine.ts))
> on every run.

---

## 1. Why role suitability matters for the mentor scenario

The mentor's pain point is not only *who is on a team* but *who does what*. A team can have the right
people yet still fail if nobody is suited to lead, document, present, or own the project's core
technology. Coordinators manually forming hundreds of students cannot reason about role fit at scale.

Part 7 makes role fit explicit and auditable: each student gets a primary role backed by a
transparent score and a plain-English reason, and each team gets a coverage summary plus warnings
when a critical role is missing, weak, or assigned against a student's stated wishes. This gives the
coordinator confidence before publishing.

---

## 2. Role catalogue

A fixed catalogue of 13 roles (`getRoleCatalogue()`). The first 10 keys match the Part 3
`StudentRolePreference` keys; the last 3 are skill-derived (no preference record required).

| Key | Label | Core skills | Useful skills | Type |
|---|---|---|---|---|
| `team_leader` | Team Leader | project_management, presentation, documentation | research, frontend, backend | coordination |
| `frontend_developer` | Frontend Developer | frontend, ui_ux | testing, documentation | technical |
| `backend_developer` | Backend Developer | backend, database | devops, testing | technical |
| `database_designer` | Database Designer | database, backend | documentation, testing | technical |
| `ui_ux_designer` | UI/UX Designer | ui_ux, frontend | research, presentation | design |
| `qa_tester` | QA / Testing Lead | testing, documentation | frontend, backend | quality |
| `documentation_lead` | Documentation Lead | documentation, research | presentation, project_management | communication |
| `research_lead` | Research Lead | research, documentation | presentation, ai_ml | research |
| `presentation_lead` | Presentation Lead | presentation, documentation | ui_ux, project_management | communication |
| `client_communication_lead` | Client / Supervisor Communication Lead | presentation, project_management, documentation | research | communication |
| `ai_ml_specialist` | AI / ML Specialist | ai_ml, backend | database, research | technical |
| `mobile_developer` | Mobile Developer | mobile_development, frontend | ui_ux, testing | technical |
| `devops_support` | DevOps Support | devops, backend | testing, database | technical |

For the three skill-derived roles, a missing `StudentRolePreference` is treated as **neutral** (not
zero) so strong skills alone can earn the role.

---

## 3. Inputs used by the scoring logic

Per student (all operational, from Part 3): `StudentSkill` (level + interest), `StudentRolePreference`
(preferenceLevel, confidenceLevel, avoid), and `StudentFormationProfile.weeklyCapacityHours` /
`maxConcurrentTasks`. Per team: the assigned `ProjectTopic` (`requiredSkills`, `preferredSkills`) and
the set of teammates (for coverage and concentration checks).

**Never used:** `CognitiveProfile`, `privateSupportNotes`. No diagnosis or neurodivergent labels enter
the role logic or any stored output.

---

## 4. Formula and weights

`scoreStudentForRole(student, role, teamContext)` returns a 0–100 score with a transparent breakdown:

| Component | Weight | How it is computed |
|---|---|---|
| Skill match | 40% | Per-skill contribution (level 4+ = 100, 3 = 70, 2 = 35, 1 = 15, missing = 0; interest is a small ±8 nudge). Core skills weighted 75%, useful skills 25%. |
| Role preference | 25% | `preferenceLevel` 1–5 → 20–100; missing preference → neutral 60. |
| Confidence | 20% | `confidenceLevel` 1–5 → 20–100; missing → neutral 60. |
| Project relevance | 10% | 40 base; +30 per role core-skill the topic *requires*, +12 per core-skill the topic *prefers*; no topic → 50. |
| Capacity fit | 5% | Soft signal. Higher weekly capacity slightly boosts coordination/communication roles; low capacity never excludes anyone. |

```
raw = skill*0.40 + preference*0.25 + confidence*0.20 + projectRelevance*0.10 + capacityFit*0.05
if (avoided) raw -= 55
score = clamp(round(raw), 0, 100)
```

### Team role assignment

`assignRolesForDraftTeam(teamContext)` assigns **one primary role per student**:

1. Compute the team's required roles (`computeRequiredRoles`): always `team_leader`,
   `documentation_lead`, `presentation_lead`, plus topic-driven technical roles
   (frontend→`frontend_developer`, backend→`backend_developer`, database→`database_designer`,
   ui_ux→`ui_ux_designer`, testing→`qa_tester`, ai_ml→`ai_ml_specialist`,
   mobile_development→`mobile_developer`, devops→`devops_support`, research→`research_lead`).
2. **Phase 1** — cover each required role (priority order) with the best-suited unassigned member.
3. **Phase 2** — every remaining member gets their single best catalogue role.

Because each student is removed once assigned, leadership/communication roles cannot all land on one
person. Deterministic tie-breakers: higher score → higher relevant core-skill level → higher
preferenceLevel → email → name → id.

### Updated team `roleScore`

Replaces the Part 5 heuristic and still contributes to `overallScore` via `FormationRuleSet.roleWeight`:

```
roleScore = roleCoverageScore*0.45 + avgAssignedSuitability*0.35 + keyRoleCoverage*0.20
            − 10 per avoided-role assignment    (clamped 0–100)
```

where `keyRoleCoverage` is the fraction of {team_leader, documentation_lead, presentation_lead}
covered.

---

## 5. Avoid-role handling

If a student marked `avoid = true` for a role, that role's score takes a large penalty (−55), so the
engine routes around it. A student is only assigned an avoided role when nothing better is available
for them; when that happens the engine raises a `ROLE_AVOIDANCE_CONFLICT` (HIGH) warning naming the
team and role so a coordinator can intervene.

---

## 6. Project-specific role relevance

The assigned `ProjectTopic.requiredSkills` boost roles whose core skills the project needs:

- An **AI project** boosts `ai_ml_specialist` (and backend/research-adjacent roles).
- A **mobile project** boosts `mobile_developer`, `ui_ux_designer`, `frontend_developer`.
- A **data-heavy project** boosts `database_designer`, `backend_developer`.
- A **presentation/education project** boosts documentation/presentation roles via preferred skills.

Topic-required technical roles are also treated as more critical in coverage and warnings (see §7).

---

## 7. Role coverage warnings

`calculateRoleCoverage` classifies each required role as **covered** (assigned, suitability ≥ 55, no
weak core skills), **weak** (assigned but below that bar), or **missing**. `roleCoverageScore =
(covered + 0.5×weak) / required × 100`. Warnings (`buildRoleSuitabilityWarnings`) use the Part 7
`FormationWarningType` additions:

| Condition | Type | Severity |
|---|---|---|
| No member is a strong, non-avoided Team Leader | `NO_CLEAR_LEADER` | HIGH |
| Required role uncovered (topic-required technical role) | `MISSING_ROLE_COVERAGE` | CRITICAL |
| Required role uncovered (other) | `MISSING_ROLE_COVERAGE` | HIGH / MEDIUM |
| Member assigned a role with suitability < 45 | `LOW_ROLE_CONFIDENCE` | MEDIUM |
| Avoided role assigned because no alternative existed | `ROLE_AVOIDANCE_CONFLICT` | HIGH |
| Required technical role held by a member with weak core skills | `ROLE_SKILL_MISMATCH` | HIGH / MEDIUM |
| One member is the top fit for most leadership/communication roles | `LOW_ROLE_CONFIDENCE` | MEDIUM |
| Overall `roleCoverageScore` < 50 | `MISSING_ROLE_COVERAGE` | MEDIUM |

Warnings persist as `DraftTeamWarning` rows and appear in the coordinator workspace alongside other
team warnings.

---

## 8. Privacy boundaries

- `CognitiveProfile` is never queried.
- `privateSupportNotes` is never read or stored.
- `DraftTeamMember.metadata` stores only non-sensitive evidence: `roleSuitabilityScore`,
  `roleSuitabilityBreakdown` (skill/preference/confidence/projectRelevance/capacityFit),
  `matchedSkills`, `weakSkills`, `avoidedRole`, and a plain-text `assignmentReason`.
- `DraftTeam.metadata.roleCoverage` stores `requiredRoles`, `coveredRoles`, `missingRoles`,
  `weakRoles`, `roleCoverageScore`, and `roleAssignmentVersion: "role-suitability-v1"`.
- No diagnosis, neurodivergent label, or raw support-preference flag is stored or shown.

A run was verified to contain no `privateSupportNotes`, no raw `prefers_*` flags, and no private-note
text in its persisted output.

---

## 9. How a coordinator manually overrides roles

In the Team Formation Workspace (`/dashboard/coordinator/team-formation`), expand a draft team to see
each member's suggested role, its **role confidence** (suitability 0–100), the **Why this role**
explanation, and the team's **Role Coverage** summary (covered / weak / missing). To override, click
the pencil next to a member's role and pick any catalogue role; the change is saved to the
`DraftTeamMember` and re-validated. Manual overrides are preserved through publishing, where
`team_leader` → `LEADER`, `co_leader` → `CO_LEADER`, and every other role → `MEMBER` (Part 6 mapping
is unchanged).

---

## 10. What Part 8 will add

Part 8 builds **capacity-aware task allocation** on top of these roles: it will use each member's
assigned role plus `weeklyCapacityHours` / `maxConcurrentTasks` to distribute tasks fairly, balance
load, and avoid overloading any single member. Part 7's role assignments and the per-member
suitability evidence are the inputs Part 8 consumes; the separate conflict/gap dashboard is Part 9.
