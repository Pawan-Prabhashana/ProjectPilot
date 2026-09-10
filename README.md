# ProjectPilot

Year-long university group project management for **students** (sprint execution) and **supervisors** (team oversight), with an optional AI intelligence layer.

ProjectPilot is a Next.js App Router app with a strict `src/` layout: UI in `src/components`, business rules in `src/server/services`, database access in `src/server/repositories`, and AI in `src/server/ai`.

---

## Quick start

```bash
git clone https://github.com/Pawan-Prabhashana/ProjectPilot.git
cd ProjectPilot

cp .env.example .env
# Set DATABASE_URL (PostgreSQL)
# Optional: OPENAI_API_KEY for live team-risk and sprint reports

npm install
npx prisma db push
npx prisma db seed
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

| Surface | URL |
|---------|-----|
| Landing | http://localhost:3000 |
| Student sprint board | http://localhost:3000/student |
| Supervisor deck | http://localhost:3000/supervisor |

---

## Demo accounts (after seed)

Password for all: `demo1234`

| Role | Email |
|------|--------|
| Supervisor | `supervisor@demo.com` |
| Student | `student@demo.com` |
| Student | `nisha@demo.com` |
| Student | `ruvan@demo.com` |

The seed creates **1 supervisor**, **3 students**, **1 team**, **1 project**, and **15 tasks** (done, in progress, overdue, backlog).

---

## What is in this build

| Area | What you get |
|------|------------|
| **Student deck** | Active tasks vs backlog, create-task dialog (React Query + server actions) |
| **Supervisor deck** | Overview stats, teams table, AI health badge + sprint report |
| **Tasks** | Status, priority, due date, assignee must be on the project team |
| **Intelligence** | `analyzeTeamRisk` (structured Zod JSON) and markdown sprint reports |

If `OPENAI_API_KEY` is not set, risk analysis and reports use a **deterministic fallback** so the dashboards still work.

---

## Stack

- Next.js 14 (App Router) + TypeScript  
- Tailwind CSS + Shadcn UI  
- Prisma + PostgreSQL  
- TanStack Query  
- Vercel AI SDK (`generateObject` / `generateText`) with Zod schemas  

---

## Useful scripts

```bash
npm run dev          # http://localhost:3000
npm run build
npm run lint
npx prisma db push   # apply schema
npx prisma db seed   # reset demo data (destructive)
npx prisma studio
```

---

## Folder layout

```
src/
  app/                 # routes, layouts, server actions
  components/          # UI (landing, dashboards, Shadcn)
  hooks/               # React Query hooks
  server/
    repositories/      # Prisma access
    services/          # domain rules
    ai/                # team risk + sprint reports
prisma/
  schema.prisma
  seed.ts
```

---

## Environment

See `.env.example`. Required: `DATABASE_URL`. Optional: `OPENAI_API_KEY` for live OpenAI calls.
