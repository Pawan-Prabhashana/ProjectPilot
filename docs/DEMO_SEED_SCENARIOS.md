# Demo Seed Scenarios (Part 13)

## Demo Dataset Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Coordinator | 1 | `coord@demo.com` |
| Supervisors | 10 | 3 named + 7 bulk (`supervisor01-07@demo.com`) |
| Students | 72 | 12 named + 60 bulk (`student001-060@demo.com`) |
| Teams (published) | 4 | Team Vertex, Nova, Horizon, Pulse |
| Project Topics | 25 | 10 original + 15 new (all OPEN) |
| Project Preferences | ~180+ | ~3 per student |
| Formation Profiles | 72 | 60 submitted, some draft/incomplete |
| Conflict Records | ~18 | Mix of OVER_SELECTED, NO_INTEREST, CAPACITY_EXCEEDED, MISSING_PREFS |

---

## Demo Accounts (password: `demo1234` for all)

| Role | Email | Notes |
|------|-------|-------|
| Coordinator | `coord@demo.com` | Full coordinator access |
| Supervisor | `dr.perera@demo.com` | Team Vertex + Pulse supervisor |
| Supervisor | `dr.fernando@demo.com` | Team Nova supervisor |
| Supervisor | `prof.silva@demo.com` | Team Horizon supervisor |
| Supervisor | `supervisor01@demo.com` | Bulk demo supervisor |
| Student | `ruvan@demo.com` | Team Vertex, key demo user |
| Student | `aisha@demo.com` | Team Vertex lead |
| Student | `sachith@demo.com` | Team Nova lead |
| Student | `student001@demo.com` | Bulk frontend/UI student |
| Student | `student011@demo.com` | Bulk backend/DB student |
| Student | `student021@demo.com` | Bulk AI/ML student |
| Student | `student031@demo.com` | Bulk mobile student |
| Student | `student056@demo.com` | Incomplete profile (conflict scenario) |
| Student | `student058@demo.com` | No project preferences submitted |

---

## Student Persona Types (bulk students 1-60)

| Range | Persona | Skills | Capacity |
|-------|---------|--------|----------|
| 1-10 | Frontend/UI | frontend (4-5), ui_ux (4), testing (2) | 12h/week |
| 11-20 | Backend/Database | backend (4-5), database (4), devops (2) | 15h/week |
| 21-30 | AI/ML | ai_ml (4-5), backend (3), research (3) | 10h/week |
| 31-40 | Mobile/DevOps | mobile_development (4-5), devops (3), frontend (2) | 12h/week |
| 41-50 | Documentation/Research | documentation (4), research (4), presentation (4-5) | 8h/week |
| 51-55 | Partial profiles | frontend (3), backend (2) | 6h/week |
| 56-60 | Conflict scenarios | No skills (58-60) / no prefs (56-60) | 8h/week |

---

## Designed Conflict Scenarios

### 1. Over-Selected Topic
Students 1-20 all rank the first open topic as their **first choice**, creating a heavy `OVER_SELECTED` conflict visible in the Project Topics page and Conflict Dashboard.

### 2. No-Interest Topic
The "Legacy COBOL System Migration Tool" topic (`legacy-cobol-migration-tool`) has no supervisor assigned and receives zero student preferences → `NO_INTEREST` conflict.

### 3. Capacity Exceeded
Popular topics with `maxStudents: 4-5` receive 15+ expressions of interest → `CAPACITY_EXCEEDED` conflict.

### 4. Missing Preferences
Students 56-60 (emails `student056@demo.com`–`student060@demo.com`) have no submitted project preferences → `STUDENT_MISSING_PREFERENCES` conflict shown in dashboard.

### 5. Incomplete Profiles
Students 51-60 have incomplete formation profiles (DRAFT status, completion score ~40%) → formation readiness risks in Conflict Dashboard.

### 6. Workload Overload
Team Vertex has overloaded task allocation demo data (Part 8). The Conflict Dashboard will show overload warnings for team members.

### 7. Team Without Supervisor
Run the formation engine with the bulk dataset and some draft teams may not have a supervisor link, producing published team risk warnings.

---

## Project Topics (25 total)

### Original 10 Topics
1. AI Attendance Risk Predictor
2. Neurodivergent-Friendly Study Planner
3. Smart Library Seat Booking
4. Healthcare Appointment Queue Optimiser
5. Sustainable Campus Energy Dashboard
6. Student Mental Wellbeing Check-In Platform
7. AI-Powered Assignment Feedback Assistant
8. Community Donation Matching Platform
9. Mobile Field Research Data Collector
10. Cybersecurity Awareness Training Simulator

### New 15 Topics (Part 13)
11. Accessible Campus Navigation App
12. Real-Time Campus Bus Tracker
13. Automated Peer Review & Feedback System
14. Smart Sports Facility Booking Platform
15. Anonymous Student Mental Health Check-In
16. AI-Powered Lost and Found Portal
17. Secure E-Voting System for Student Elections
18. AI Internship Matching Platform
19. Personal Carbon Footprint Tracker
20. Peer-to-Peer Online Tutoring Platform
21. Smart Campus Parking Management System
22. AI Research Paper Summariser
23. Freelance Student Services Marketplace
24. Healthcare Pharmacy Stock Manager
25. Legacy COBOL System Migration Tool *(no-interest scenario)*

---

## Suggested Demo Script (15-minute presentation)

### Setup (1 min)
```
npm run db:setup   # reset to clean demo state
npm run dev        # start server
```

### 1. Student perspective (3 min)
1. Open `http://localhost:3000` → Login as `ruvan@demo.com / demo1234`
2. Show **My Dashboard** → point to the **Capstone Journey** card
3. Click **Formation Profile** → show skills, availability, completion score
4. Click **Project Preferences** → show ranked topics, submitted status

### 2. Coordinator — readiness (3 min)
5. Login as `coord@demo.com / demo1234`
6. Show **Coordinator Dashboard** → point to the **Formation Workflow checklist** (8 steps)
7. Click **Formation Setup** → show term overview, 72-student intake, profile readiness %
8. Click **Project Topics** → show 25 topics, demand indicators, conflict cards

### 3. Coordinator — formation engine (3 min)
9. Click **Team Formation** → click **Run Draft Formation**
10. Wait for run to complete → show draft team cards with scores, roles, warnings
11. Rename one team, change a role, review warnings

### 4. Coordinator — publish & monitor (3 min)
12. Mark teams READY → click **Publish Teams**
13. Navigate to **Conflict Dashboard** → show aggregated risks by severity
14. Point to workload overload and missing supervisor risks
15. Click a risk card to expand recommended action and link

### 5. Supervisor perspective (2 min)
16. Login as `dr.perera@demo.com / demo1234`
17. Show Supervisor Dashboard → assigned teams, consultation queue
18. Click **Team Tasks & Workload** → show active tasks and member load

### 6. Task allocation (1 min)
19. Navigate to `/dashboard/tasks/new` → create a task with `required_skills: backend, database`
20. Show recommended assignee with score breakdown

---

## Resetting the Demo

To restore a clean demo state:
```bash
# Reset and reseed (idempotent — safe to run multiple times)
npm run db:setup

# Or full reset (drops all data):
npx prisma migrate reset --force
npm run db:setup
```

Running `npm run db:setup` twice will **not** create duplicates. All Part 13 bulk data is guarded by:
- `upsert` on unique keys (email, termId+slug, profileId+skillKey, etc.)
- `existingPrefCount` guard for project preferences
- `existingMilestoneCount` / `existingTaskCount` guards for milestones and tasks

---

## Expected Conflict Dashboard State After Seeding

After running `npm run db:setup`, visit `/dashboard/coordinator/conflicts` to see:

| Severity | Type | Count |
|----------|------|-------|
| HIGH | Over-selected project topics | 2+ |
| HIGH | Capacity exceeded | 2+ |
| MEDIUM | No-interest topics | 3+ |
| MEDIUM | Students missing preferences | 5 |
| MEDIUM | Incomplete formation profiles | 6+ |
| LOW | Missing role preferences | various |
| INFO | Supervisors with no teams in term | up to 7 |
