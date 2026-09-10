# ProjectPilot

Year-long university group project management for **students** who execute the work and **supervisors** who oversee teams.

ProjectPilot keeps capstone teams on track from kickoff to delivery: shared projects and tasks, student sprint boards, supervisor oversight, and an optional AI intelligence layer for team risk and weekly sprint reports.

The app runs on **http://localhost:3000**.

---

## Quick start

```bash
git clone https://github.com/Pawan-Prabhashana/ProjectPilot.git
cd ProjectPilot

cp .env.example .env
# Set DATABASE_URL (PostgreSQL). Optionally set OPENAI_API_KEY for live AI.

npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open:

- Landing: http://localhost:3000
- Student sprint: http://localhost:3000/student
- Supervisor deck: http://localhost:3000/supervisor

Do not run `npm run build` in another terminal while `npm run dev` is running.

---

## Demo accounts (after seed)

Password for all accounts: `demo1234`

| Role       | Email                 |
|------------|-----------------------|
| Supervisor | `supervisor@demo.com` |
| Student    | `student@demo.com`    |
| Student    | `nisha@demo.com`      |
| Student    | `ruvan@demo.com`      |

`npx prisma db seed` **wipes** users, teams, projects, and tasks, then recreates this snapshot: 1 supervisor, 3 students, 1 team, 1 project, 15 tasks (done, in progress, overdue, backlog).

---

## What you can do

### Students (`/student`)

- See **My active tasks** and **Project backlog**
- Create a task (assigned to the demo student on the seeded project)

### Supervisors (`/supervisor`)

- **Overview:** team, project, and overdue/at-risk counts
- **Teams:** project assignment, **health badge** from the intelligence layer, and **Generate report**
- Hover the health badge to read the analysis reasoning
- Development **role switcher** in the top nav (Student / Supervisor)

### Intelligence layer

AI code lives in `src/server/ai/` only (not in UI components).

| Function | Output |
|----------|--------|
| `analyzeTeamRisk(teamId)` | Structured `{ status, reasoning }` via Zod (`ON_TRACK` \| `AT_RISK` \| `CRITICAL`) |
| `generateSprintReport(teamId)` | Markdown weekly summary for the supervisor |

If `OPENAI_API_KEY` is **not** set, both features use a deterministic fallback so the dashboards still work.

---

## Stack

| Layer        | Choice |
|--------------|--------|
| App          | Next.js 14 App Router (`src/app`) |
| Language     | TypeScript (strict) |
| UI           | Tailwind CSS + Shadcn UI |
| Data         | Prisma + PostgreSQL |
| Client state | TanStack Query |
| Mutations    | Next.js Server Actions (`Result<T>`) |
| AI           | Vercel AI SDK (`generateObject` / `generateText`) + OpenAI |

---

## Project structure

```
src/
  app/
    page.tsx                 # Landing
    (dashboard)/
      student/page.tsx      # Student sprint
      supervisor/page.tsx   # Supervisor deck
    actions/                 # Server Actions
  components/                # UI only (layout, dashboards, Shadcn)
  hooks/                     # React Query hooks
  server/
    repositories/            # Prisma access
    services/                # Business rules
    ai/                      # Intelligence layer
  lib/
    db/                      # Prisma client
    types/                   # Result<T> and domain types
prisma/
  schema.prisma
  seed.ts
```

---

## Commands

```bash
npm run dev          # Dev server — http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx prisma db push   # Sync schema to Postgres
npx prisma db seed   # Reset and load demo data
npm run db:studio    # Prisma Studio
```

Optional in `.env`:

```bash
OPENAI_API_KEY=sk-...
```

---

## Licence

Private student project unless otherwise stated by the team.
