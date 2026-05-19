# ProjectPilot Neuro – Architecture Documentation

> **Phase 1 Foundation Reference**  
> Last updated: March 2026

---

## Overview

ProjectPilot Neuro is an AI-powered academic project management and supervisor consultation platform. It is designed specifically for neurodivergent and autistic university students — not as an accessibility add-on to a generic system, but as a platform whose *entire architecture* is shaped by cognitive diversity principles.

The architecture is structured in three concentric layers:

```
┌─────────────────────────────────────────────────────┐
│   Presentation Layer (Next.js App Router)           │
│   Role-aware dashboard shell, pages, components     │
├─────────────────────────────────────────────────────┤
│   Domain Service Layer (lib/services/)              │
│   Cognitive support, team intelligence,             │
│   supervisor bridge, project brain, task AI         │
├─────────────────────────────────────────────────────┤
│   Data Layer (Prisma + PostgreSQL)                  │
│   Extended schema with 30+ models across 11 domains │
└─────────────────────────────────────────────────────┘
```

---

## Core Product Model

### A. Personal Cognitive Support Agent
Each student has a private `CognitiveProfile` that stores:
- Communication style (how information is presented)
- Reminder style (how deadlines feel)
- Meeting format preference (async vs. structured sync)
- Overload sensitivity (how early to intervene)
- Pacing preference (steady vs. sprint-rest)
- Ambiguity comfort (tolerance for unclear tasks)
- Focus duration (typical productive session length)
- Support mode (how much AI assistance the student wants)

This data is private by design — never exposed in team-level queries without explicit student consent. It drives how task descriptions, reminders, and feedback are formatted for each individual.

### B. Shared Team AI
The `TeamHealthSignal`, `WorkloadSnapshot`, `SocialFrictionEvent`, and `ContributionTypeBreakdown` models provide the data foundation for:
- Workload fairness detection (>2× mean = imbalanced)
- Silent member identification (no activity in 7+ days)
- Friction event logging (conflict, disengagement, overload)
- Health trending (append-only health signal history)

### C. Supervisor AI Bridge
The `ConsultationBrief` and `SupervisorFeedbackParse` models enable:
- Auto-generated pre-meeting briefs from live project state
- Structured extraction of action items from raw feedback
- Clarity scoring of supervisor communication
- Explicit ambiguity detection in feedback prose

### D. Project Brain
`DecisionLog`, `OpenQuestion`, `AssumptionRecord`, and `FeedbackMemory` form the team's persistent shared memory. This is not just a note-taking feature — it is the primary mechanism for reducing cognitive load between consultations.

---

## Domain Structure

```
lib/
├── auth/
│   └── session.ts          – getCurrentUser(), getDashboardPath()
├── auth.ts                  – NextAuth options, credentials provider
├── db.ts                    – PrismaClient singleton
├── encryption.ts            – AES-256-GCM encrypt/decrypt for sensitive fields
├── env.ts                   – Zod-validated environment config
├── rbac/
│   └── index.ts             – requireAuth(), requireRole(), hasRole(), isStaff()
├── metrics/
│   ├── health.ts            – computeTeamHealth() (bug-fixed), updateTeamHealthStatus()
│   └── summaries.ts         – role-specific dashboard data queries
├── services/
│   ├── cognitive-support.ts – CognitiveProfile CRUD, OverloadSignal logging
│   ├── team-intelligence.ts – workload snapshots, friction events, silence detection
│   ├── project-brain.ts     – decisions, open questions, assumptions, feedback memory
│   ├── supervisor-bridge.ts – ConsultationBrief generation, FeedbackParse
│   └── task-intelligence.ts – TaskDecomposition, AmbiguityFlag, DependencyLink
├── utils.ts                 – cn(), formatDate(), formatDateTime()
└── validations/
    ├── auth.ts              – login/register schemas
    ├── cognitive-profile.ts – CognitiveProfile input validation
    ├── consultation.ts      – booking, availability, meeting note schemas
    ├── project-brain.ts     – decision, question, assumption schemas
    └── task.ts              – createTask/updateTask schemas
```

---

## Schema Design Decisions

### Why CognitiveProfile references StudentProfile.userId, not User.id
The cognitive profile is conceptually a student-specific construct. Anchoring it to `StudentProfile.userId` makes the intent explicit and prevents it from being accidentally attached to supervisor or coordinator users.

### Why TeamMember has a direct `profileId` FK to StudentProfile
Originally (Phase 0), TeamMember had a redundant `profile` relation via userId matching, which caused a silent migration issue. Phase 1 replaces this with an explicit `profileId` FK, making the relationship clear and allowing eager loading of the profile without going through User.

### Why Project.status is now a ProjectStatus enum, not a String
The original `String` type allowed arbitrary values that would break UI logic. The `ProjectStatus` enum (ACTIVE, ON_HOLD, COMPLETED, ARCHIVED) constrains the domain correctly.

### Why AIInsight, AmbiguityFlag use polymorphic entityType+entityId
Prisma does not support true polymorphic relations natively. Rather than creating multiple tables (TaskAmbiguityFlag, MilestoneAmbiguityFlag, etc.) we store `entityType` as an enum and `entityId` as a string. The application layer handles the join. This keeps the schema lean while allowing insights to attach to any entity type as the AI layer grows.

### Why DependencyLink stores both BLOCKS and PARALLEL_OK dependency types
Not all dependencies are blockers. A `PARALLEL_OK` link is a coordination hint — "these tasks can run concurrently but should be aware of each other." This distinction matters for neurodivergent students who benefit from explicitly knowing what they *can* do in parallel.

### Why FeedbackMemory stores keyThemes as JSON
Feedback themes are a future AI output — in Phase 2, an LLM will extract and populate this field. Storing it as JSON now means no schema migration is needed when Phase 2 lands.

---

## Security Architecture

### Password Hashing
All user passwords are hashed with bcrypt (cost factor 12) via `bcryptjs` before storage. Raw passwords are never persisted.

### Sensitive Field Encryption
`lib/encryption.ts` provides AES-256-GCM encryption for:
- `MeetingNote.privateNote` — supervisor's internal observations about student behaviour
- Future: cognitive support field exports, if the student requests a data export

AES-256-GCM provides both confidentiality (encryption) and integrity (authentication tag). The key is derived from `ENCRYPTION_SECRET` in the environment. The IV is randomised per encryption call and stored with the ciphertext.

**Fields that are NOT encrypted** (by design):
- Emails, names, task titles — these must be searchable
- Team health status, task counts — aggregate data, not sensitive

### RBAC
All sensitive server actions flow through `lib/rbac/index.ts`:
- `requireAuth()` — redirects to `/login` if no session
- `requireRole()` — throws on role mismatch (for server actions)
- `assertOwnerOrStaff()` — resource-level ownership check

Middleware (`middleware.ts`) handles coarse route-level protection. RBAC helpers handle fine-grained per-resource access.

### Environment Validation
`lib/env.ts` validates all required environment variables at startup using Zod. The application will fail fast with a clear error message rather than silently using undefined values.

---

## How AI Layers Plug In (Phase 2 Contract)

The Phase 1 service functions are written to be replaceable with AI-augmented versions without changing their callers. Specifically:

### Task Decomposition
```typescript
// Phase 1: lib/services/task-intelligence.ts
function generateRuleBasedSteps(title, description, estimatedMinutes) { ... }

// Phase 2: replace with
async function callLLMDecomposition(task: Task, projectContext: string) {
  const response = await openai.chat.completions.create({ ... });
  return parseDecompositionResponse(response);
}
```
The `TaskDecomposition` model stores a `generatedBy` field ("rule-v1", "gpt-4o") so outputs can be versioned.

### Feedback Parsing
```typescript
// Phase 1: heuristic keyword extraction in supervisor-bridge.ts
// Phase 2: replace parseSupervisorFeedback() body with LLM call
// The DB model (actionItems, expectations, ambiguities as JSON) is already shaped for LLM output
```

### Team Health
The `TeamHealthSignal` model provides historical snapshots that can feed time-series prediction models in Phase 3.

---

## Extension Points for Cloud Deployment

The architecture is prepared for the following additions without structural changes:

| Feature | Extension Point |
|---------|----------------|
| Background AI jobs | Add a queue (BullMQ/Inngest) consuming `TeamHealthSignal` or `Task` events |
| File uploads | Add `ProjectDocument` model referencing S3 keys; `Task` already has a `linkedDocumentId` slot in the design |
| Real-time notifications | WebSocket layer reads from `Notification` model; the schema is write-ahead log friendly |
| Multi-tenancy (multiple universities) | Add `Organisation` model; link `CoordinatorProfile` to it |
| LLM cost tracking | Add `AIJobLog` model recording model, token count, and insight ID |

---

## Phase 1 Completed Scope

| Area | Status |
|------|--------|
| Extended Prisma schema (30+ models) | ✅ |
| Bug fix: team health `where` duplicate key | ✅ |
| Bug fix: TeamMember redundant profile relation | ✅ |
| Bug fix: Project.status String → enum | ✅ |
| Env validation (Zod) | ✅ |
| RBAC helpers | ✅ |
| Zod validations for all domains | ✅ |
| Service layer: cognitive-support | ✅ |
| Service layer: team-intelligence | ✅ |
| Service layer: project-brain | ✅ |
| Service layer: supervisor-bridge | ✅ |
| Service layer: task-intelligence | ✅ |
| Refactored health metrics | ✅ |
| Extended dashboard summaries | ✅ |
| App route structure (public/auth/dashboard) | ✅ |
| Landing page | ✅ |
| Login/Register pages | ✅ |
| Overview page (role-aware) | ✅ |
| Cognitive Profile page | ✅ |
| Team Workspace page | ✅ |
| Project Brain page | ✅ |
| Tasks page | ✅ |
| Consultations page | ✅ |
| Supervisor Hub page | ✅ |
| Team Insights page | ✅ |
| Settings/Accessibility page | ✅ |
| Seed script with realistic demo data | ✅ |
| Architecture documentation | ✅ |

---

## Phase 2 Recommendations

1. **LLM integration**: Wire `task-intelligence.ts` and `supervisor-bridge.ts` to an LLM (OpenAI/Anthropic) using the existing JSON field contracts.
2. **Real-time overload detection**: Add a webhook or cron job that scans `OverloadSignal` and creates `AIInsight` records proactively.
3. **Task CRUD UI**: Build the task creation, assignment, and decomposition flows on top of the existing service layer.
4. **Consultation booking UI**: The availability/booking schema is complete — build the slot picker and agenda form.
5. **Cognitive profile-aware UI**: Read `CognitiveProfile` in server components and adjust tone, layout, and step count accordingly.
6. **Contribution logging UI**: Log entries already go to `ContributionLog`; build the team-facing form.
7. **Notifications system**: The `Notification` model exists; add the background job that creates and delivers them.
