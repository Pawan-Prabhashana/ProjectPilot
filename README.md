# ProjectPilot

**An intelligent capstone team formation, role assignment, task allocation, and conflict detection platform — with neurodivergent-first support built in.**

ProjectPilot helps faculty coordinators form balanced student project teams, assign suitable roles,
distribute tasks fairly, and detect risks such as skill gaps, overloaded students, duplicate project
choices, and schedule conflicts. It replaces the error-prone manual process of forming hundreds of
capstone students each semester with a system that can match individuals by skill, schedule, and role
suitability — then keep teams on track through delivery.

Neurodivergent-first support remains a core differentiator: a **private** support layer gives students
clearer communication, lower cognitive load, and structured task guidance. This support data is never
exposed to coordinators or supervisors — it is used only as safe support preferences for the student.

> **Status:** The operational foundation (role-based dashboards, teams, supervisors, consultations,
> team health, and the neurodivergent support toolkit) is in place. The intelligent formation engine,
> skill/schedule matching, role assignment, and capacity-aware task allocation are the planned next
> modules — see [`docs/MENTOR_REQUIREMENT_MAPPING.md`](docs/MENTOR_REQUIREMENT_MAPPING.md) for the
> full requirement-to-roadmap mapping.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Pawan-Prabhashana/ProjectPilot.git
cd ProjectPilot

# 2. Copy and configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_SECRET

# 3. Install dependencies
npm install

# 4. Set up database + seed demo data
npm run db:setup

# 5. Start development server
npm run dev
# → http://localhost:3000
```

### Demo Credentials (after seeding)

| Role        | Email                    | Password   |
|-------------|--------------------------|------------|
| Student     | `ruvan@demo.com`         | `demo1234` |
| Supervisor  | `dr.perera@demo.com`     | `demo1234` |
| Coordinator | `coord@demo.com`         | `demo1234` |

Full demo walkthrough: [`docs/DEMO.md`](docs/DEMO.md)

---

## What ProjectPilot Does

> **Coordinators** form and oversee balanced teams · **Supervisors** guide and review · **Students**
> deliver with neurodivergent-friendly support. The capabilities below are the operational foundation;
> the intelligent formation engine builds directly on this data.

### For Students

| Feature | What it does |
|---------|-------------|
| **Focus Mode** | Low-clutter, one-task view with decomposition steps, definition of done, and session timer hints |
| **Low-Energy Mode** | One gentle next step derived from real task state; shows what can wait today |
| **Communication Translator** | Rewrites messages in 6 styles: direct, gentle, academic formal, supervisor-ready, action list, peer collaborative |
| **Social Signal Decoder** | Detects hidden signals in messages: soft deadlines, ownership ambiguity, implied criticism, hidden assumptions |
| **Meeting Recovery Mode** | Post-consultation recovery view with top 3 actions, what-can-wait list, and a gentle re-entry point |
| **Confidence Support** | Progress reassurance grounded in real completed task data; "what counts as enough today" |
| **Next-Best-Action** | Deterministic priority ranking (overdue → due soon → blocking others → next in line) |

### For Teams

| Feature | What it does |
|---------|-------------|
| **Team Health Signals** | Explainable signals for workload imbalance, milestone risk, engagement gaps, ambiguity accumulation |
| **Ambiguity Detector** | Flags tasks missing assignee, due date, definition of done, or clear description |
| **Workload Fairness Engine** | Compares task load, overdue burden, and hidden support work across members |
| **Dependency Risk Map** | Identifies blocked tasks, stalled chains, and single-point dependency concentrations |
| **Clarification Burden Tracker** | Makes invisible coordination and translation work visible |
| **Friction Signal Detector** | Detects coordination patterns that may indicate team friction (framed as systems, not people) |

### For Supervisors

| Feature | What it does |
|---------|-------------|
| **Supervisor Bridge** | Automatically translates raw meeting notes into structured action items, quality expectations, and ambiguity flags |
| **Pre-Meeting Brief** | Auto-generated project status snapshot, risks, and suggested agenda items |
| **Consultation Management** | Schedule, confirm, and review consultation slots with structured booking forms |
| **Team Oversight** | At-a-glance team health, at-risk indicators, and pending confirmation queue |

### For Coordinators

| Feature | What it does |
|---------|-------------|
| **Formation Readiness Overview** | Platform-wide counts, setup health, unassigned students, and team/supervisor/project gaps |
| **Team Management** | Operational overview of every team — membership, leadership, supervisor coverage, project status |
| **Supervisor Management** | Supervisor capacity and team coverage overview, ready for capacity-aware allocation |
| **At-Risk Flags** | Critical and at-risk team detection with counts |
| **Consultation Overview** | All upcoming and past consultations across teams |

> **Planned next modules:** intelligent team formation, skill/schedule matching, role assignment
> engine, capacity-aware task allocation, gap detection, and a schedule conflict detector.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Presentation Layer — Next.js 14 App Router                         │
│  Role-aware dashboard shell · Server Components · Client islands     │
├─────────────────────────────────────────────────────────────────────┤
│  Domain Service Layer — lib/services/                               │
│  communication-support · support-intelligence · team-intelligence   │
│  supervisor-bridge · project-brain · cognitive-support              │
│  task-intelligence · workspace · consultation-readiness             │
├─────────────────────────────────────────────────────────────────────┤
│  Data Layer — Prisma ORM + PostgreSQL                               │
│  30+ models across 11 domains · JSONB for flexible AI outputs       │
│  AES-256-GCM field encryption · bcrypt password hashing             │
└─────────────────────────────────────────────────────────────────────┘
```

Full architecture documentation: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
Deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## Route Map

| Route | Role | Description |
|-------|------|-------------|
| `/` | Public | Landing page |
| `/login`, `/register` | Public | Authentication |
| `/dashboard/overview` | All | Role-personalised dashboard |
| `/dashboard/support-tools` | Student | Support tools hub |
| `/dashboard/support-tools/focus` | Student | Focus Mode |
| `/dashboard/support-tools/low-energy` | Student | Low-Energy Mode |
| `/dashboard/support-tools/communicate` | Student | Communication Translator + Social Decoder |
| `/dashboard/tasks` | Student + Supervisor | Task board |
| `/dashboard/tasks/[id]` | Student + Supervisor | Task detail |
| `/dashboard/team` | Student + Supervisor | Team workspace with intelligence snapshot |
| `/dashboard/team-insights` | All | Team Intelligence dashboard (role-filtered) |
| `/dashboard/project-brain` | Student + Supervisor | Decisions, questions, assumptions, feedback memory |
| `/dashboard/contributions` | Student + Supervisor | Contribution intelligence and fairness |
| `/dashboard/consultations` | All | Consultation list and booking |
| `/dashboard/consultations/[id]` | All | Detail, pre-meeting brief, translated feedback, recovery mode |
| `/dashboard/supervisor-workspace` | Supervisor + Coordinator | Team oversight and supervisor tools |
| `/dashboard/cognitive-profile` | Student | Support profile setup |
| `/dashboard/settings` | All | Accessibility preferences |

---

## Service Layer

| Service | File | Responsibility |
|---------|------|----------------|
| Communication Support | `lib/services/communication-support.ts` | Message translation (6 styles), social signal detection (8 types), meeting recovery summaries |
| Support Intelligence | `lib/services/support-intelligence.ts` | Next-best-action, smallest-useful-step, confidence support, low-energy view, focus mode data |
| Team Intelligence | `lib/services/team-intelligence.ts` | Health signals, ambiguity detection, workload profiling, dependency risks, clarification burden, friction signals |
| Supervisor Bridge | `lib/services/supervisor-bridge.ts` | Feedback parsing, action item extraction, clarity scoring, pre-meeting brief generation |
| Project Brain | `lib/services/project-brain.ts` | Decision log, open questions, assumptions, feedback memory operations |
| Cognitive Support | `lib/services/cognitive-support.ts` | Cognitive profile CRUD, accessibility settings, overload signals |
| Task Intelligence | `lib/services/task-intelligence.ts` | Ambiguity flag creation, task decomposition, next-step derivation |
| Workspace | `lib/services/workspace.ts` | Team workspace snapshot aggregation |
| Consultation Readiness | `lib/services/consultation-readiness.ts` | Pre-meeting readiness scoring |
| Contribution Intelligence | `lib/services/contribution-intelligence.ts` | Contribution type analysis, fairness detection |

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14 |
| Language | TypeScript | 5 |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5 |
| Authentication | NextAuth.js | 4 |
| UI | Tailwind CSS + shadcn/ui | — |
| Icons | Lucide React | — |
| Validation | Zod | — |
| Password hashing | bcryptjs | — |
| Field encryption | Node.js `crypto` (AES-256-GCM) | — |
| Runtime | Node.js | 20 |

---

## Data & Privacy

ProjectPilot Neuro was designed with GDPR principles from the start:

- **Data minimisation:** `CognitiveProfile` is private by default. Support outputs are not persisted.
- **Purpose limitation:** Student cognitive data is never included in supervisor or coordinator queries.
- **Security by design:** Field-level AES-256-GCM encryption for `privateNote`; bcrypt cost 12 for passwords.
- **Audit logging:** Key user actions are written to `ActivityLog` with entity references (not personal data values).
- **Safe error handling:** API routes return safe error messages; no stack traces or database details exposed.

See the Security section in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for a full security checklist.

---

## Cloud Deployment

ProjectPilot Neuro is designed for AWS deployment:

```
Route 53 → CloudFront → App Runner (Docker) → RDS PostgreSQL
                                           → Secrets Manager
                                           → CloudWatch Logs
```

Quick deploy with Docker:

```bash
DOCKER_BUILD=true docker build -t projectpilot-neuro .
docker run -p 3000:3000 -e DATABASE_URL="..." -e NEXTAUTH_URL="..." \
  -e NEXTAUTH_SECRET="..." -e ENCRYPTION_SECRET="..." \
  projectpilot-neuro
```

Full deployment guide including GitHub Actions CI/CD: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## Development Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also runs prisma generate)
npm run lint         # ESLint
npm run db:push      # Sync Prisma schema to database
npm run db:seed      # Seed demo data
npm run db:setup     # db:push + db:seed (full fresh setup)
npm run db:studio    # Open Prisma Studio (database browser)
```

---

## Project Structure

```
├── app/
│   ├── (auth)/               # Login, register
│   ├── (dashboard)/          # All authenticated pages
│   │   └── dashboard/
│   │       ├── support-tools/    # Focus, Low-Energy, Communication tools
│   │       ├── team-insights/    # Team Intelligence dashboard
│   │       ├── consultations/    # Consultation list + detail + recovery
│   │       └── ...               # Other pages
│   ├── (public)/             # Landing page
│   └── api/                  # API route handlers
│       └── support/          # Support tool APIs (private to students)
├── components/
│   ├── support/              # CommunicationTranslator, SocialTranslator, FocusTaskPicker
│   ├── consultations/        # Consultation forms and actions
│   ├── tasks/                # Task components
│   ├── layout/               # Sidebar, topbar, shell
│   ├── shared/               # PageHeader, InfoCallout, HealthBadge, EmptyState
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── services/             # All domain service logic
│   ├── metrics/              # Health, workload, summary calculations
│   ├── rbac/                 # Role-based access control helpers
│   ├── validations/          # Zod schemas
│   ├── auth.ts               # NextAuth configuration
│   ├── db.ts                 # Prisma client
│   ├── encryption.ts         # AES-256-GCM field encryption
│   ├── env.ts                # Environment variable validation
│   ├── logger.ts             # Structured logger (JSON in prod, coloured in dev)
│   └── utils.ts              # cn(), formatDate(), etc.
├── prisma/
│   ├── schema.prisma         # Full data model (30+ models, 11 domains)
│   └── seed.ts               # Realistic demo data
└── docs/
    ├── ARCHITECTURE.md       # Domain model and architectural decisions
    ├── DEPLOYMENT.md         # AWS/Docker deployment guide
    ├── DEMO.md               # Demo walkthrough and talking points
    └── VIVA.md               # Technical viva defense guide
```

---

## Why This Exists

Most academic PM tools assume neurotypical users. They were designed for professional software teams,
not for university students navigating final-year projects with limited support structures, unclear
supervisor communication, and the real cognitive challenges of executive dysfunction, sensory
sensitivity, and anxiety.

ProjectPilot Neuro treats neurodivergent support not as an accessibility layer, but as a core
architectural concern. Every feature decision, database model, and service design was made with
the question: *does this reduce cognitive load, clarify expectations, or support re-entry after
overwhelm?*

---

## Entrepreneurial Potential

ProjectPilot Neuro has a clear path beyond a final-year project:

- **University licensing model:** SaaS deployed per-institution, priced per department or per cohort
- **LMS integration:** Moodle/Canvas LTI plugin for SSO + gradebook sync (Phase 2)
- **Research platform:** Anonymised aggregate data for academic research on neurodivergent student outcomes
- **Enterprise adaptation:** The same patterns apply in workplace teams — onboarding clarity,
  communication translation, meeting recovery — for organisations with neurodiversity inclusion goals
- **NHS / disability services integration:** Partnership potential with student disability services
  for proactive, early intervention support

The neurodivergent student support market is systematically underserved by existing SaaS tools.
ProjectPilot Neuro addresses a real, documented gap with a technically sophisticated, privacy-respecting,
and genuinely useful platform.

---

## Further Reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Domain model, service layer design, schema decisions
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — AWS deployment, Docker, CI/CD, security checklist
- [`docs/DEMO.md`](docs/DEMO.md) — Demo walkthrough, credentials, judge talking points
- [`docs/VIVA.md`](docs/VIVA.md) — Technical viva defense: architecture rationale, tradeoffs, future roadmap
