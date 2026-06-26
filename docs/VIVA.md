# ProjectPilot — Technical Viva Defense Guide

> Use this document to prepare confident, precise answers for viva and judging.

> **Product framing:** ProjectPilot is an intelligent capstone **team formation, role assignment, task
> allocation, and conflict detection** platform. Its primary purpose is to help faculty coordinators
> form balanced student teams and keep them on track. **Neurodivergent-first support is a strong,
> private differentiator layer** — not the whole product. The sections below explain the support layer
> in depth (a key innovation); for how the mentor's team-formation requirements map to the current
> system and the staged roadmap, see [`MENTOR_REQUIREMENT_MAPPING.md`](MENTOR_REQUIREMENT_MAPPING.md).

---

## 1. Why This Problem Matters

**The gap:** Most academic project management tools (Trello, Jira, Asana, GitHub Projects) are built for
professional software teams. They assume neurotypical users, linear thinking, explicit communication, and
self-directed scheduling. For neurodivergent university students — particularly those with ADHD, autism,
dyslexia, or anxiety — these tools actively increase cognitive load rather than reduce it.

**The scale:** Approximately 15–20% of the university population identifies as neurodivergent (various
NHS/university studies, 2020–2024). Most of them are completing final-year projects without systematic
cognitive support infrastructure.

**The consequence:** Unclear supervisor feedback leads to rumination. Ambiguous tasks lead to avoidance.
Workload inequality in teams is invisible. Students with executive function challenges struggle to re-enter
work after breaks. These are not personal failings — they are systems problems.

ProjectPilot Neuro addresses this at the system level, not by "fixing" students, but by making the
project management environment itself more comprehensible, predictable, and supportive.

---

## 2. What Makes This Platform Innovative

### 2.1 Neurodivergent-first by design, not by accommodation
The platform was not built as a generic PM tool with accessibility bolted on. Every model, service, and
UI decision was made with cognitive diversity in mind:
- `CognitiveProfile` is a first-class data model, not a settings afterthought
- Support outputs are private by design — students are not pathologised in team views
- Communication translation exists because autistic and ADHD students face real documented barriers in
  interpreting indirect academic communication
- Focus Mode and Low-Energy Mode reflect actual executive function support patterns from occupational
  therapy research

### 2.2 Explainable intelligence — no black boxes
Every signal, recommendation, and warning in the system has:
- a `reason` field explaining why it was triggered
- a confidence indicator where relevant
- a human-readable text description that appears in the UI

This is a deliberate Phase 1 architectural constraint. It makes the system trustworthy,
defensible in an academic context, and independently verifiable.

### 2.3 Social translation at the application level
No prior academic PM tool attempts to decode the social subtext of supervisor communication. Our
`analyzeSocialSubtext()` function identifies 8 categories of hidden communication signals that are
known barriers for neurodivergent students: soft deadlines, passive assignment, hidden assumptions,
implied criticism, etc.

### 2.4 Role-aware intelligence that respects privacy boundaries
The team intelligence layer (`Team Insights`) never exposes individual cognitive profile data.
Supervisor views show team-level patterns only. Student support outputs are private.
This architectural choice was deliberate, documented, and enforced at the service layer.

---

## 3. Architecture Decisions

### 3.1 Why Next.js App Router (full-stack)?
- Eliminates a separate API service — single deployment unit
- Server Components allow data to be fetched at the server without client-side waterfalls
- Server Actions + route handlers provide a clean, typed API layer
- Co-location of data fetching with rendering reduces complexity for a solo/small-team build

### 3.2 Why PostgreSQL + Prisma?
- Relational data structure maps precisely to our domain: teams → projects → milestones → tasks
- Prisma provides type-safe queries, generated client, and migration management
- PostgreSQL's JSONB columns are used for structured but flexible fields (e.g. `actionItems`,
  `decompositionSteps`) without requiring a separate NoSQL store
- The schema's design uses composite indexes and selective `@unique` constraints to ensure query
  performance at scale

### 3.3 Why AES-256-GCM field encryption?
The `privateNote` field in `MeetingNote` and potentially future sensitive fields are encrypted at the
application layer (not only at rest via database encryption). This means:
- Even a database dump does not expose private supervisor notes in plaintext
- The encryption key is separate from the database credentials
- We can rotate the encryption key without rotating the database password

### 3.4 Why deterministic intelligence first (no LLM in Phase 1)?
Four reasons:
1. **Explainability:** Rule-based systems produce outputs that can be fully audited and defended
2. **Reliability:** No external API dependencies means no latency spikes or rate limits affecting demos
3. **Academic integrity:** A final-year project demonstrating 30+ working deterministic heuristics is more
   impressive than a thin wrapper around an LLM
4. **Extensibility:** All service interfaces are defined with typed outputs. Swapping in an LLM
   implementation in Phase 2 requires changing the implementation, not the interface

### 3.5 Why RBAC at the service layer, not just middleware?
Middleware handles route-level auth (is the user logged in?). Service-layer RBAC handles resource-level
auth (can this user see this resource?). Both are required:
- `requireAuth()` — validates session exists and returns typed user
- `requireRole()` — throws if user lacks the required role
- Resource ownership checks inline — e.g., checking `team.members.some(m => m.userId === user.id)`

---

## 4. Database Design Rationale

### 4.1 Polymorphic flags
`AmbiguityFlag` is a polymorphic model: `entityType: 'TASK' | 'NOTE' | 'MILESTONE'` + `entityId`.
This avoids a separate flag model for each entity type and allows the same detection/display logic
to work across different content types.

### 4.2 Append-only health signals
`TeamHealthSignal` uses a log-pattern rather than an update-in-place pattern. This means:
- Historical health trend data is preserved
- Regression detection is possible (team gets worse over time)
- No data is silently overwritten by a health recalculation

### 4.3 JSONB for structured AI outputs
Fields like `actionItems`, `suggestedAgendaItems`, and `decompositionSteps` use Prisma's `Json` type
(PostgreSQL JSONB). This gives structure without requiring separate junction tables for every action
item, and allows the schema to evolve without migrations for minor field additions.

### 4.4 Soft-deletion and status fields
`Task.status` includes `CANCELLED` rather than hard-deleting tasks. This preserves:
- Historical contribution log accuracy
- Completed/cancelled ratio metrics
- Team intelligence context (cancelled tasks can indicate workload relief or scope creep)

---

## 5. Security and Privacy Reasoning

| Concern                            | Design decision                                                              |
|------------------------------------|------------------------------------------------------------------------------|
| Cognitive profile privacy          | Never included in team-level queries; service layer enforced                 |
| Support output privacy             | Communication translation, social analysis outputs are not persisted         |
| Field-level encryption             | `privateNote` field uses AES-256-GCM at the application layer               |
| Password security                  | bcrypt with cost factor 12; never stored or logged in plaintext              |
| Session security                   | NextAuth JWT with NEXTAUTH_SECRET; tokens are httpOnly, SameSite=Lax        |
| CSRF protection                    | Next.js App Router Server Actions use built-in CSRF protection               |
| Data boundaries                    | Student IDs are validated against team membership before any team query      |
| Error exposure                     | API errors return safe messages, never stack traces or db error details      |
| Logging                            | Structured logger never logs personal data values — only IDs and event names |

---

## 6. Cloud Architecture Reasoning

See `docs/DEPLOYMENT.md` for full details. Key decisions:

- **App Runner over EC2:** No server management, true auto-scaling, pay-per-request. Suitable for
  variable university usage patterns (heavy during milestone weeks, quiet otherwise)
- **RDS over self-managed DB:** Automated backups, Multi-AZ failover, OS patching, PITR recovery
- **Secrets Manager over env files:** Secrets can be rotated without redeployment; audit trail on access
- **CloudFront over direct App Runner URL:** HTTPS everywhere, DDoS mitigation, static asset caching
- **Structured JSON logging:** Compatible with CloudWatch Insights for log querying and alarm configuration

---

## 7. Tradeoffs and Limitations

| Limitation                                  | Acknowledged tradeoff                                                      |
|---------------------------------------------|----------------------------------------------------------------------------|
| No real-time collaboration                  | Deferred to Phase 2; adds WebSocket complexity not needed for MVP           |
| Deterministic AI (no LLM)                   | Explicit Phase 1 constraint; planned for Phase 2 via typed service swap     |
| No email notifications in Phase 1           | Notification model and schema exist; SMTP/SES delivery deferred             |
| No file upload                              | S3 integration extension point documented; not needed for core functionality|
| Settings page not connected to layout       | `focusMode` and `lowEnergyMode` saved to DB; layout wiring deferred to P2  |
| Single-institution model                    | Multi-tenant extension requires Row-Level Security; designed for later      |

---

## 8. Future Enhancements (Confident Phase 2 Roadmap)

1. **LLM integration** — all service interfaces are typed; swap implementation behind `CommunicationStyle` → `translateWithLLM()`
2. **Real-time collaboration** — WebSocket layer via Pusher or AWS API Gateway for live team workspace
3. **Email notifications** — SES + queue-backed delivery using the existing `Notification` model
4. **Mobile app** — React Native with shared API layer; same auth sessions
5. **Multi-institutional deployment** — Row-Level Security in PostgreSQL + tenant-scoped schemas
6. **LMS integration** — Moodle/Canvas LTI plugin so students log in with university SSO
7. **Accessibility settings wiring** — live `focusMode`/`lowEnergyMode` layout switching from saved preferences
8. **Supervisor analytics** — aggregate, anonymised cohort trends for academic research

---

## 9. Key Talking Points for Viva

**"Why not just use Jira with accessibility plugins?"**
> Jira accessibility plugins address motor/visual disability — not cognitive load, executive dysfunction,
> or the specific challenges of indirect academic communication. Jira has no awareness of supervisor
> feedback, milestone anxiety, or neurodivergent pacing needs. ProjectPilot Neuro addresses a fundamentally
> different problem.

**"How do you ensure the AI signals are accurate?"**
> Phase 1 uses deterministic rule-based heuristics. Every signal has a reason text and a confidence
> level. We did not claim accuracy — we claimed explainability. A student or supervisor can read exactly
> why a warning was raised and decide whether it applies. That is more valuable than a 94% accurate
> black box in an academic context.

**"Is this GDPR/data-privacy compliant?"**
> The system is designed with GDPR principles from the start: data minimisation (cognitive profile is
> private by default), purpose limitation (support data is never used for team-visible analytics),
> security by design (field encryption, bcrypt, JWT), and the right to erasure (Cascade deletes on user
> deactivation). Full compliance audit would precede commercial deployment.

**"What is the value over a shared Google Doc?"**
> A shared Google Doc has no awareness of task state, team health, deadlines, or communication patterns.
> It provides no cognitive support, no signal detection, no role-aware access, and no structured
> intelligence. ProjectPilot Neuro is an active system — it derives meaning from project state, not just
> stores it.

**"How does this scale?"**
> The architecture is stateless at the application layer (no server-side session state — JWT only), which
> means horizontal scaling via App Runner or ECS. Database is the primary bottleneck, addressed by RDS
> read replicas and query optimisation (indexed foreign keys, selective includes). Team intelligence
> signals can be moved to background jobs (SQS + Lambda) for scaling without impacting page load times.
