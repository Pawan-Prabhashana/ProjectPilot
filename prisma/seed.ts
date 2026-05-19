/**
 * Seed script for ProjectPilot Neuro demo data.
 *
 * Creates a realistic university project management scenario:
 * - 1 coordinator
 * - 3 supervisors (Dr. Nimal Perera, Dr. Ayesha Fernando, Prof. Kavindu Silva)
 * - 4 student teams with multiple students each
 * - Projects, milestones, tasks, consultation slots and bookings
 * - Project Brain entries (decisions, open questions, assumptions, feedback memory)
 * - Cognitive profiles for students
 * - Team health signals and workload snapshots
 *
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

async function main() {
  console.log('🌱  Seeding ProjectPilot Neuro demo data…\n');

  const passwordHash = await hash(DEMO_PASSWORD, 12);

  // ── Coordinator ─────────────────────────────────────────────────────────────

  const coordinator = await prisma.user.upsert({
    where: { email: 'coord@demo.com' },
    update: {},
    create: {
      email: 'coord@demo.com',
      name: 'Ms. Dilrukshi Rathnayake',
      role: 'COORDINATOR',
      passwordHash,
      coordinatorProfile: { create: {} },
      accessibilitySetting: { create: {} },
    },
  });
  console.log('✓  Coordinator:', coordinator.email);

  // ── Supervisors ──────────────────────────────────────────────────────────────

  const supervisorData = [
    { email: 'dr.perera@demo.com', name: 'Dr. Nimal Perera', title: 'Dr.', department: 'Computer Science' },
    { email: 'dr.fernando@demo.com', name: 'Dr. Ayesha Fernando', title: 'Dr.', department: 'Information Systems' },
    { email: 'prof.silva@demo.com', name: 'Prof. Kavindu Silva', title: 'Prof.', department: 'Software Engineering' },
  ];

  const supervisors: Awaited<ReturnType<typeof prisma.supervisorProfile.findUniqueOrThrow>>[] = [];

  for (const s of supervisorData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        role: 'SUPERVISOR',
        passwordHash,
        supervisorProfile: { create: { title: s.title, department: s.department } },
        accessibilitySetting: { create: {} },
      },
    });
    const profile = await prisma.supervisorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    supervisors.push(profile);
    console.log('✓  Supervisor:', user.email);
  }

  const [supPerera, supFernando, supSilva] = supervisors;

  // ── Students & Teams ─────────────────────────────────────────────────────────

  const teamDefinitions = [
    {
      name: 'Team Vertex',
      slug: 'team-vertex',
      supervisorProfile: supPerera,
      projectTitle: 'Smart Attendance Insight Platform',
      projectDescription:
        'A web-based platform that uses facial recognition and RFID to automate lecture attendance and generate real-time analytics for lecturers.',
      students: [
        { email: 'aisha@demo.com', name: 'Aisha Fernando', studentId: 'CS21001', role: 'LEADER' as const },
        { email: 'ruvan@demo.com', name: 'Ruvan Mendis', studentId: 'CS21002', role: 'MEMBER' as const },
        { email: 'thilini@demo.com', name: 'Thilini Jayasena', studentId: 'CS21003', role: 'MEMBER' as const },
      ],
    },
    {
      name: 'Team Nova',
      slug: 'team-nova',
      supervisorProfile: supFernando,
      projectTitle: 'IoT Lab Resource Tracker',
      projectDescription:
        'An IoT-enabled system to monitor and optimise usage of lab equipment, alert on anomalies, and generate utilisation reports for faculty administrators.',
      students: [
        { email: 'sachith@demo.com', name: 'Sachith Wijeratne', studentId: 'IS21010', role: 'LEADER' as const },
        { email: 'kavya@demo.com', name: 'Kavya Dissanayake', studentId: 'IS21011', role: 'MEMBER' as const },
        { email: 'milan@demo.com', name: 'Milan Bandara', studentId: 'IS21012', role: 'MEMBER' as const },
      ],
    },
    {
      name: 'Team Horizon',
      slug: 'team-horizon',
      supervisorProfile: supSilva,
      projectTitle: 'AI-Powered Campus FAQ Assistant',
      projectDescription:
        'A conversational AI chatbot trained on university FAQs, academic calendars, and administrative documents to assist students with queries 24/7.',
      students: [
        { email: 'nadeesha@demo.com', name: 'Nadeesha Perera', studentId: 'SE21020', role: 'LEADER' as const },
        { email: 'chamath@demo.com', name: 'Chamath Alwis', studentId: 'SE21021', role: 'MEMBER' as const },
        { email: 'ishani@demo.com', name: 'Ishani Ranawaka', studentId: 'SE21022', role: 'MEMBER' as const },
      ],
    },
    {
      name: 'Team Pulse',
      slug: 'team-pulse',
      supervisorProfile: supPerera,
      projectTitle: 'Sustainable Waste Monitoring Dashboard',
      projectDescription:
        'A sensor-integrated web dashboard that tracks campus waste bin fill levels, routes collection vehicles efficiently, and visualises sustainability metrics.',
      students: [
        { email: 'dinusha@demo.com', name: 'Dinusha Kumarasinghe', studentId: 'CS21030', role: 'LEADER' as const },
        { email: 'sahan@demo.com', name: 'Sahan Rathnasiri', studentId: 'CS21031', role: 'MEMBER' as const },
        { email: 'vishmi@demo.com', name: 'Vishmi Wickramasinghe', studentId: 'CS21032', role: 'MEMBER' as const },
      ],
    },
  ];

  for (const teamDef of teamDefinitions) {
    console.log(`\n  Team: ${teamDef.name}`);

    // Create team
    const team = await prisma.team.upsert({
      where: { slug: teamDef.slug },
      update: {},
      create: {
        name: teamDef.name,
        slug: teamDef.slug,
        supervisorId: teamDef.supervisorProfile.id,
        healthStatus: 'ON_TRACK',
      },
    });

    // Create students + student profiles + team memberships
    for (const s of teamDef.students) {
      const user = await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          email: s.email,
          name: s.name,
          role: 'STUDENT',
          passwordHash,
          studentProfile: { create: { studentId: s.studentId } },
          accessibilitySetting: { create: {} },
        },
      });

      const studentProfile = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: user.id } });

      // Upsert team membership
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: {},
        create: {
          teamId: team.id,
          userId: user.id,
          profileId: studentProfile.id,
          role: s.role,
        },
      });

      // Create a cognitive profile for each student (varied preferences)
      await prisma.cognitiveProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          communicationStyle: randomFrom(['STEP_BY_STEP', 'DETAILED', 'DIRECT', 'VISUAL_FIRST']),
          reminderStyle: randomFrom(['STRUCTURED', 'GENTLE', 'DEADLINE_FOCUSED']),
          preferredMeetingFormat: randomFrom(['STRUCTURED_AGENDA', 'ASYNC_PREFERRED', 'SHORT_SYNC']),
          overloadSensitivity: randomFrom(['LOW', 'MEDIUM', 'HIGH']),
          pacingPreference: randomFrom(['STEADY', 'SPRINT_REST', 'FLEXIBLE']),
          ambiguityComfort: randomFrom(['LOW', 'MEDIUM', 'HIGH']),
          focusDurationMinutes: randomFrom([25, 45, 60, 90, null]),
          supportMode: randomFrom(['MINIMAL', 'MODERATE', 'COMPREHENSIVE']),
          onboardingCompleted: true,
        },
      });

      console.log(`    ✓ Student: ${user.email}`);
    }

    // Create project
    const project = await prisma.project.upsert({
      where: { teamId: team.id },
      update: {},
      create: {
        teamId: team.id,
        title: teamDef.projectTitle,
        description: teamDef.projectDescription,
        status: 'ACTIVE',
      },
    });

    // Milestones
    const milestones = await createMilestones(project.id);

    // Tasks (realistic mix across statuses and assignees)
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
      select: { userId: true },
    });
    await createTasks(project.id, milestones, teamMembers.map((m) => m.userId));

    // Contribution logs (each member gets a distinct contribution mix)
    for (let mi = 0; mi < teamMembers.length; mi++) {
      await createContributionLogs(project.id, teamMembers[mi].userId, mi);
    }

    // Project Brain entries (supervisor userId comes from the supervisorProfile.userId)
    await createProjectBrainEntries(project.id, teamMembers[0].userId, teamDef.supervisorProfile.userId);

    // Consultation availability (for this team's supervisor)
    const slots = await createConsultationAvailability(teamDef.supervisorProfile.id);

    // Book a consultation (upcoming + one past with meeting notes for demo)
    if (slots.length > 0) {
      await createConsultationBooking(team.id, slots, teamDef.projectTitle, teamDef.supervisorProfile.userId);
    }

    console.log(`    ✓ Project, milestones, tasks, and consultation created`);
  }

  // ── Team health signals ───────────────────────────────────────────────────────

  const allTeams = await prisma.team.findMany({ select: { id: true } });
  for (const { id } of allTeams) {
    await prisma.teamHealthSignal.create({
      data: {
        teamId: id,
        healthStatus: 'ON_TRACK',
        overdueTaskCount: Math.floor(Math.random() * 2),
        totalOpenTasks: Math.floor(Math.random() * 6) + 3,
        activeMemberCount: 3,
        hasActivityThisWeek: true,
        nextMilestoneIsOnTrack: true,
        workloadIsFair: true,
      },
    });
  }

  // ── Demo enrichments: dependency links + overload signals + accessibility ──────

  const vertexTeam = await prisma.team.findUnique({ where: { slug: 'team-vertex' } });
  if (vertexTeam) {
    const vertexProject = await prisma.project.findFirst({ where: { teamId: vertexTeam.id } });
    if (vertexProject) {
      const tasks = await prisma.task.findMany({ where: { projectId: vertexProject.id } });

      // Create dependency links between related tasks (auth → API, design → implementation)
      const authTask = tasks.find((t) => t.title.toLowerCase().includes('auth'));
      const apiTask = tasks.find((t) => t.title.toLowerCase().includes('api') && !t.title.toLowerCase().includes('auth'));
      const designTask = tasks.find((t) => t.title.toLowerCase().includes('design') || t.title.toLowerCase().includes('architect'));
      const implementTask = tasks.find((t) => t.title.toLowerCase().includes('implement') || t.title.toLowerCase().includes('core'));

      if (authTask && apiTask) {
        await prisma.dependencyLink.upsert({
          where: { sourceTaskId_targetTaskId: { sourceTaskId: authTask.id, targetTaskId: apiTask.id } },
          update: {},
          create: {
            sourceTaskId: authTask.id,
            targetTaskId: apiTask.id,
            dependencyType: 'BLOCKS',
            note: 'API endpoints require authenticated sessions. Authentication must be complete first.',
          },
        });
        console.log('    ✓ Dependency link: auth → API');
      }
      if (designTask && implementTask) {
        await prisma.dependencyLink.upsert({
          where: { sourceTaskId_targetTaskId: { sourceTaskId: designTask.id, targetTaskId: implementTask.id } },
          update: {},
          create: {
            sourceTaskId: designTask.id,
            targetTaskId: implementTask.id,
            dependencyType: 'BLOCKS',
            note: 'Implementation should not begin until the system design is approved by the supervisor.',
          },
        });
        console.log('    ✓ Dependency link: design → implementation');
      }
    }
  }

  // Overload signals for Ruvan (the primary demo student) — demonstrates the signal model
  const ruvan = await prisma.user.findUnique({ where: { email: 'ruvan@demo.com' } });
  if (ruvan) {
    const existingSignals = await prisma.overloadSignal.count({ where: { userId: ruvan.id } });
    if (existingSignals === 0) {
      await prisma.overloadSignal.create({
        data: {
          userId: ruvan.id,
          severity: 'HIGH',
          context: '3 tasks assigned simultaneously with overlapping deadlines. All marked HIGH priority.',
          triggeredAt: daysAgo(5),
          resolved: false,
        },
      });
      await prisma.overloadSignal.create({
        data: {
          userId: ruvan.id,
          severity: 'MEDIUM',
          context: 'Ambiguous task assigned without definition of done or clear deliverable.',
          triggeredAt: daysAgo(14),
          resolved: true,
          resolvedAt: daysAgo(10),
        },
      });
      console.log('    ✓ Overload signals created for Ruvan');
    }

    // Give Ruvan a distinctive accessibility state for demo (low-energy mode saved)
    await prisma.accessibilitySetting.upsert({
      where: { userId: ruvan.id },
      update: { lowEnergyMode: false }, // default off so demo can show the toggle
      create: { userId: ruvan.id, lowEnergyMode: false },
    });
  }

  console.log('\n✅  Seeding complete!\n');
  console.log('Demo credentials (all passwords: demo1234)');
  console.log('─'.repeat(50));
  console.log('  Coordinator : coord@demo.com');
  console.log('  Supervisors : dr.perera@demo.com');
  console.log('                dr.fernando@demo.com');
  console.log('                prof.silva@demo.com');
  console.log('  Students    : ruvan@demo.com   (Team Vertex, key demo user)');
  console.log('                aisha@demo.com   (Team Vertex, lead)');
  console.log('                sachith@demo.com (Team Nova, lead)');
  console.log('                nadeesha@demo.com (Team Horizon, lead)');
  console.log('                dinusha@demo.com  (Team Pulse, lead)');
  console.log('─'.repeat(50));
  console.log('\nDemo walkthrough: docs/DEMO.md');
}

// ── Helper functions ──────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function createMilestones(projectId: string) {
  const milestoneData = [
    { title: 'Project Proposal & Requirements', dueDate: daysAgo(21), status: 'COMPLETED' as const, orderIndex: 0 },
    { title: 'System Design & Architecture', dueDate: daysAgo(7), status: 'IN_PROGRESS' as const, orderIndex: 1 },
    { title: 'Core Feature Implementation', dueDate: daysFromNow(21), status: 'PENDING' as const, orderIndex: 2 },
    { title: 'Testing & Quality Assurance', dueDate: daysFromNow(42), status: 'PENDING' as const, orderIndex: 3 },
    { title: 'Final Submission & Presentation', dueDate: daysFromNow(63), status: 'PENDING' as const, orderIndex: 4 },
  ];

  const milestones = [];
  for (const m of milestoneData) {
    const milestone = await prisma.milestone.create({
      data: { projectId, ...m },
    });
    milestones.push(milestone);
  }
  return milestones;
}

async function createTasks(
  projectId: string,
  milestones: { id: string }[],
  assigneeIds: string[]
) {
  const [m0, m1, m2, m3, m4] = milestones; // proposal, design, implement, testing, final

  type TaskDef = {
    title: string;
    description: string;
    doneCriteria: string;
    status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate: Date;
    estimatedMinutes: number;
    cognitiveLoad: number;
    milestoneId?: string;
    blockerNote?: string;
    assigneeIdx: number;
  };

  const taskDefs: TaskDef[] = [
    // Milestone 1: Proposal (COMPLETED)
    {
      title: 'Draft project proposal abstract',
      description: 'Write a concise abstract (250–300 words) summarising the problem, proposed solution, and expected outcomes. Must be approved by the team before submission.',
      doneCriteria: 'Abstract approved by all team members and submitted to the supervisor. Word count between 250–300.',
      status: 'DONE', priority: 'HIGH',
      dueDate: daysAgo(28), estimatedMinutes: 120, cognitiveLoad: 2, milestoneId: m0?.id, assigneeIdx: 0,
    },
    {
      title: 'Define project scope and in/out boundaries',
      description: 'Create a clear scope document listing exactly what the project will and will not cover. Avoid scope creep during implementation.',
      doneCriteria: 'Scope table reviewed and signed off by supervisor. At least 5 "in scope" and 3 "out of scope" items listed.',
      status: 'DONE', priority: 'HIGH',
      dueDate: daysAgo(25), estimatedMinutes: 90, cognitiveLoad: 3, milestoneId: m0?.id, assigneeIdx: 1,
    },
    // Milestone 2: Design (IN_PROGRESS)
    {
      title: 'Finalise entity-relationship diagram',
      description: 'Create the ER diagram showing all tables, primary/foreign keys, and relationships. Must include all entities discussed in the proposal.',
      doneCriteria: 'ER diagram reviewed by supervisor at last meeting. All entities have clear relationships shown. Diagram stored in /docs folder.',
      status: 'DONE', priority: 'HIGH',
      dueDate: daysAgo(14), estimatedMinutes: 180, cognitiveLoad: 4, milestoneId: m1?.id, assigneeIdx: 2,
    },
    {
      title: 'Design database schema and run migrations',
      description: 'Translate the ER diagram into a Prisma schema. Create all models, relations, enums, and indexes. Run migrations on the dev database.',
      doneCriteria: 'Prisma schema matches ER diagram. npx prisma db push succeeds with no errors. All models accessible via Prisma Studio.',
      status: 'DONE', priority: 'HIGH',
      dueDate: daysAgo(7), estimatedMinutes: 90, cognitiveLoad: 3, milestoneId: m1?.id, assigneeIdx: 0,
    },
    {
      title: 'Draft system architecture document',
      description: 'Document the overall system architecture including frontend, backend, database, and any third-party services. Include a deployment diagram.',
      doneCriteria: 'Architecture doc in /docs. Reviewed by supervisor. Frontend, backend, and database layers clearly described with a diagram.',
      status: 'REVIEW', priority: 'HIGH',
      dueDate: daysFromNow(2), estimatedMinutes: 180, cognitiveLoad: 4, milestoneId: m1?.id, assigneeIdx: 1,
    },
    // Milestone 3: Implementation (PENDING — tasks mostly TODO/IN_PROGRESS)
    {
      title: 'Implement user authentication module',
      description: 'Build login, registration, and session management. Use NextAuth with Prisma adapter. Support email/password login for now.',
      doneCriteria: 'Users can register, log in, and stay logged in across page refreshes. JWT stored in a secure httpOnly cookie. Tested with at least 3 test accounts.',
      status: 'IN_PROGRESS', priority: 'HIGH',
      dueDate: daysFromNow(5), estimatedMinutes: 240, cognitiveLoad: 4, milestoneId: m2?.id, assigneeIdx: 0,
    },
    {
      title: 'Implement core API endpoints',
      description: 'Build the main REST API endpoints for the primary data entities. Follow the API spec document. Return consistent JSON responses with proper HTTP status codes.',
      doneCriteria: 'All endpoints in the API spec return correct responses. Error handling returns meaningful error messages. Tested manually with Postman or similar.',
      status: 'TODO', priority: 'HIGH',
      dueDate: daysFromNow(14), estimatedMinutes: 300, cognitiveLoad: 5, milestoneId: m2?.id,
      blockerNote: 'Blocked: waiting for authentication module to be complete before implementing auth-protected routes.',
      assigneeIdx: 1,
    },
    {
      title: 'Conduct initial user interviews (3 participants)',
      description: 'Interview 3 target users using the prepared questions. Record key findings, pain points, and feature requests. Summarise in a short report.',
      doneCriteria: 'Notes from 3 separate interviews stored in /research. Key findings summarised in a 1-page report shared with team.',
      status: 'IN_PROGRESS', priority: 'MEDIUM',
      dueDate: daysFromNow(3), estimatedMinutes: 150, cognitiveLoad: 3, milestoneId: m2?.id, assigneeIdx: 2,
    },
    {
      title: 'Build dashboard UI with real data',
      description: 'Create the main dashboard page with stat cards, charts, and tables pulling from the database. Must be responsive.',
      doneCriteria: 'Dashboard shows live data (no hardcoded values). Works on mobile (375px) and desktop. All stats match the database state.',
      status: 'TODO', priority: 'HIGH',
      dueDate: daysFromNow(18), estimatedMinutes: 300, cognitiveLoad: 5, milestoneId: m2?.id, assigneeIdx: 0,
    },
    {
      title: 'Validate system architecture with supervisor',
      description: 'Present the architecture diagram and tech stack decisions to the supervisor. Get explicit approval or revision notes before implementation continues.',
      doneCriteria: 'Meeting notes from architecture review stored. Supervisor has either approved or provided specific revision requests. Decision logged in Project Brain.',
      status: 'TODO', priority: 'HIGH',
      dueDate: daysFromNow(4), estimatedMinutes: 60, cognitiveLoad: 2, milestoneId: m2?.id, assigneeIdx: 1,
    },
    // Milestone 4: Testing (PENDING)
    {
      title: 'Write unit tests for data layer',
      description: 'Write comprehensive unit tests for all Prisma service functions. Use Jest. Aim for 80%+ coverage on service layer.',
      doneCriteria: 'Test suite runs with npm test. Coverage report shows ≥80% on service files. All tests pass on a fresh database.',
      status: 'TODO', priority: 'MEDIUM',
      dueDate: daysFromNow(28), estimatedMinutes: 180, cognitiveLoad: 4, milestoneId: m3?.id, assigneeIdx: 2,
    },
    {
      title: 'Prepare sprint review slides',
      description: 'Create the slides for the next sprint review presentation. Include: completed features, demo screenshots, blockers, and next sprint plan.',
      doneCriteria: 'Slide deck in shared folder. Contains demo screenshots. Reviewed by team. Estimated 10–12 slides.',
      status: 'TODO', priority: 'MEDIUM',
      dueDate: daysFromNow(7), estimatedMinutes: 60, cognitiveLoad: 2, milestoneId: m2?.id, assigneeIdx: 0,
    },
    // An overdue task for realistic demo
    {
      title: 'Fix critical performance issue in data queries',
      description: 'Dashboard metric queries are too slow (> 2s). Profile the queries and add appropriate database indexes or query optimisations.',
      doneCriteria: 'Dashboard load time under 500ms on local dev. Query profiling results documented. Before/after response times recorded.',
      status: 'IN_PROGRESS', priority: 'URGENT',
      dueDate: daysAgo(3), estimatedMinutes: 90, cognitiveLoad: 4, milestoneId: m2?.id, assigneeIdx: 1,
      blockerNote: 'Investigation in progress. Suspect N+1 query in the team workload endpoint.',
    },
  ];

  const createdTasks: { id: string; title: string }[] = [];

  for (const t of taskDefs) {
    const task = await prisma.task.create({
      data: {
        projectId,
        milestoneId: t.milestoneId ?? null,
        title: t.title,
        description: t.description,
        doneCriteria: t.doneCriteria,
        blockerNote: t.blockerNote ?? null,
        cognitiveLoad: t.cognitiveLoad,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedMinutes: t.estimatedMinutes,
        assigneeId: assigneeIds[t.assigneeIdx % assigneeIds.length],
      },
    });
    createdTasks.push({ id: task.id, title: task.title });
  }

  // Add dependency links between tasks for realistic blocker chains
  const authTask = createdTasks.find((t) => t.title.includes('authentication'));
  const apiTask = createdTasks.find((t) => t.title.includes('core API'));
  const dashboardTask = createdTasks.find((t) => t.title.includes('dashboard UI'));
  const schemaTask = createdTasks.find((t) => t.title.includes('database schema'));
  const archTask = createdTasks.find((t) => t.title.includes('architecture with supervisor'));
  const archDocTask = createdTasks.find((t) => t.title.includes('system architecture document'));

  if (authTask && apiTask) {
    await prisma.dependencyLink.upsert({
      where: { sourceTaskId_targetTaskId: { sourceTaskId: apiTask.id, targetTaskId: authTask.id } },
      update: {},
      create: {
        sourceTaskId: apiTask.id,
        targetTaskId: authTask.id,
        dependencyType: 'BLOCKS',
        note: 'API endpoints with authentication require the auth module to be complete first.',
      },
    });
  }
  if (schemaTask && authTask) {
    await prisma.dependencyLink.upsert({
      where: { sourceTaskId_targetTaskId: { sourceTaskId: authTask.id, targetTaskId: schemaTask.id } },
      update: {},
      create: {
        sourceTaskId: authTask.id,
        targetTaskId: schemaTask.id,
        dependencyType: 'REQUIRES_OUTPUT',
        note: 'NextAuth Prisma adapter requires the User model in the database schema.',
      },
    });
  }
  if (schemaTask && dashboardTask) {
    await prisma.dependencyLink.upsert({
      where: { sourceTaskId_targetTaskId: { sourceTaskId: dashboardTask.id, targetTaskId: schemaTask.id } },
      update: {},
      create: {
        sourceTaskId: dashboardTask.id,
        targetTaskId: schemaTask.id,
        dependencyType: 'REQUIRES_OUTPUT',
        note: 'Dashboard needs the schema in place to query real data.',
      },
    });
  }
  if (archDocTask && archTask) {
    await prisma.dependencyLink.upsert({
      where: { sourceTaskId_targetTaskId: { sourceTaskId: archTask.id, targetTaskId: archDocTask.id } },
      update: {},
      create: {
        sourceTaskId: archTask.id,
        targetTaskId: archDocTask.id,
        dependencyType: 'BLOCKS',
        note: 'Cannot validate architecture until the document is drafted and ready for review.',
      },
    });
  }

  // Add ambiguity flags for tasks missing clear criteria
  const userInterviewTask = createdTasks.find((t) => t.title.includes('user interviews'));
  if (userInterviewTask) {
    await prisma.ambiguityFlag.create({
      data: {
        entityType: 'TASK',
        entityId: userInterviewTask.id,
        description: 'No assignee confirmed for all 3 interviews. Who is scheduling the participants? Timeline not confirmed.',
        flaggedBy: 'system',
        severity: 'MEDIUM',
      },
    });
  }

  // Add task decompositions for complex tasks
  if (authTask) {
    await prisma.taskDecomposition.create({
      data: {
        taskId: authTask.id,
        steps: [
          { title: 'Install NextAuth and configure the Prisma adapter', estimatedMinutes: 30, orderIndex: 0, done: true },
          { title: 'Create login and register API routes', estimatedMinutes: 45, orderIndex: 1, done: true },
          { title: 'Build login page UI with form validation', estimatedMinutes: 45, orderIndex: 2, done: false },
          { title: 'Test auth flows with multiple accounts', estimatedMinutes: 30, orderIndex: 3, done: false },
          { title: 'Add session-based route protection (middleware)', estimatedMinutes: 30, orderIndex: 4, done: false },
        ],
        estimatedTotalMinutes: 180,
        generatedBy: 'seed-v1',
      },
    });
  }
  if (apiTask) {
    await prisma.taskDecomposition.create({
      data: {
        taskId: apiTask.id,
        steps: [
          { title: 'List all required API endpoints from the spec', estimatedMinutes: 30, orderIndex: 0, done: false },
          { title: 'Implement CRUD endpoints for primary entities', estimatedMinutes: 120, orderIndex: 1, done: false },
          { title: 'Add Zod validation for request bodies', estimatedMinutes: 60, orderIndex: 2, done: false },
          { title: 'Write error-handling middleware', estimatedMinutes: 45, orderIndex: 3, done: false },
          { title: 'Test all endpoints with Postman', estimatedMinutes: 45, orderIndex: 4, done: false },
        ],
        estimatedTotalMinutes: 300,
        generatedBy: 'seed-v1',
      },
    });
  }

  return createdTasks;
}

// Index determines contribution variety — each team member gets a distinct but overlapping mix
async function createContributionLogs(projectId: string, userId: string, memberIndex: number) {
  const allContributions = [
    // Lead member (index 0) — planning, writing, coordination, some code
    [
      { description: 'Completed ER diagram draft and presented to team for review', hours: 2.5, type: 'DESIGN' as const, daysAgo_: 32 },
      { description: 'Led sprint planning session — broke down milestone 2 tasks into sub-tasks', hours: 1.5, type: 'PLANNING' as const, daysAgo_: 28 },
      { description: 'Wrote project proposal introduction, scope, and objectives sections', hours: 2.0, type: 'WRITING' as const, daysAgo_: 24 },
      { description: 'Coordinated supervisor meeting logistics — prepared agenda, took notes', hours: 1.0, type: 'COORDINATION' as const, daysAgo_: 21 },
      { description: 'Reviewed Ruvan\'s auth implementation and suggested session handling improvements', hours: 1.5, type: 'REVIEW' as const, daysAgo_: 14 },
      { description: 'Clarified ambiguous acceptance criteria for API endpoints with team', hours: 0.5, type: 'CLARIFICATION' as const, daysAgo_: 10 },
      { description: 'Wrote meeting prep document for consultation — pulled key questions from Project Brain', hours: 1.0, type: 'DOCUMENTATION' as const, daysAgo_: 7 },
      { description: 'Implemented project settings page and team configuration forms', hours: 3.0, type: 'CODE' as const, daysAgo_: 5 },
    ],
    // Member 2 (index 1) — coding, research, testing
    [
      { description: 'Implemented user authentication with NextAuth and Prisma adapter', hours: 4.0, type: 'CODE' as const, daysAgo_: 18 },
      { description: 'Conducted literature review on related attendance tracking systems', hours: 2.0, type: 'RESEARCH' as const, daysAgo_: 30 },
      { description: 'Designed database schema — all models, enums, and indexes', hours: 3.0, type: 'CODE' as const, daysAgo_: 10 },
      { description: 'Investigated and profiled slow API queries — documented findings', hours: 2.5, type: 'CODE' as const, daysAgo_: 3 },
      { description: 'Clarified requirements for multi-supervisor support with team', hours: 0.5, type: 'CLARIFICATION' as const, daysAgo_: 12 },
      { description: 'Wrote technical documentation for database schema decisions', hours: 1.5, type: 'DOCUMENTATION' as const, daysAgo_: 8 },
    ],
    // Member 3 (index 2) — research, writing, user research
    [
      { description: 'Conducted 2 of 3 planned user interviews — drafted findings summary', hours: 3.0, type: 'RESEARCH' as const, daysAgo_: 6 },
      { description: 'Wrote literature review section of the proposal', hours: 2.5, type: 'WRITING' as const, daysAgo_: 25 },
      { description: 'Prepared system architecture diagram from initial design discussions', hours: 2.0, type: 'DESIGN' as const, daysAgo_: 15 },
      { description: 'Attended stand-up and unblocked Aisha on scope definition ambiguity', hours: 0.5, type: 'UNBLOCKING_SUPPORT' as const, daysAgo_: 22 },
      { description: 'Wrote testing plan document outlining test categories and coverage goals', hours: 1.5, type: 'DOCUMENTATION' as const, daysAgo_: 11 },
    ],
  ];

  const contributions = allContributions[memberIndex % allContributions.length];

  for (const c of contributions) {
    await prisma.contributionLog.create({
      data: {
        projectId,
        userId,
        description: c.description,
        hours: c.hours,
        contributionType: c.type,
        loggedAt: daysAgo(c.daysAgo_),
      },
    });
  }

  // Update ContributionTypeBreakdown summaries
  const breakdown = await prisma.contributionLog.groupBy({
    by: ['contributionType'],
    where: { projectId, userId },
    _count: { id: true },
    _sum: { hours: true },
  });

  for (const b of breakdown) {
    await prisma.contributionTypeBreakdown.upsert({
      where: { projectId_userId_contributionType: { projectId, userId, contributionType: b.contributionType } },
      update: { count: b._count.id, totalHours: b._sum.hours ?? 0, lastLoggedAt: new Date() },
      create: { projectId, userId, contributionType: b.contributionType, count: b._count.id, totalHours: b._sum.hours ?? 0 },
    });
  }
}

async function createProjectBrainEntries(
  projectId: string,
  studentUserId: string,
  supervisorUserId: string
) {
  // Decisions
  await prisma.decisionLog.create({
    data: {
      projectId,
      title: 'Use Next.js App Router over Pages Router',
      rationale: 'App Router supports server components natively, which gives us better performance and cleaner data fetching patterns. The team agreed after reviewing the Next.js 14 documentation.',
      madeBy: studentUserId,
      impact: 'All routing and data fetching patterns will use the App Router convention.',
    },
  });

  await prisma.decisionLog.create({
    data: {
      projectId,
      title: 'Use PostgreSQL with Prisma instead of MongoDB',
      rationale: 'Our data has clear relational structure (teams, tasks, milestones) that maps well to SQL. The supervisor confirmed PostgreSQL is preferred for this type of academic system.',
      madeBy: studentUserId,
      madeAt: daysAgo(14),
    },
  });

  // Open questions
  await prisma.openQuestion.create({
    data: {
      projectId,
      question: 'Should the system support multiple supervisors per team, or strictly one supervisor?',
      raisedBy: studentUserId,
      priority: 'HIGH',
      raisedAt: daysAgo(5),
    },
  });

  await prisma.openQuestion.create({
    data: {
      projectId,
      question: 'What is the expected file size limit for uploaded project documents?',
      raisedBy: studentUserId,
      priority: 'MEDIUM',
      raisedAt: daysAgo(3),
    },
  });

  // Assumptions
  await prisma.assumptionRecord.create({
    data: {
      projectId,
      statement: 'Students will have a consistent internet connection and access to a modern browser during their work sessions.',
      loggedBy: studentUserId,
      loggedAt: daysAgo(20),
    },
  });

  await prisma.assumptionRecord.create({
    data: {
      projectId,
      statement: 'The university already has an SMTP mail server available for notification emails.',
      loggedBy: studentUserId,
      loggedAt: daysAgo(10),
    },
  });

  // Feedback memory
  await prisma.feedbackMemory.create({
    data: {
      projectId,
      authorId: supervisorUserId,
      content: 'The proposal structure is good but the scope section needs to be more specific. You should clearly list what is IN scope and OUT of scope. Also, the ER diagram needs to show all relationships explicitly — I noticed some implied foreign keys that aren\'t drawn.',
      source: 'meeting',
      sentiment: 'constructive',
      keyThemes: ['scope definition', 'ER diagram', 'documentation clarity'],
      recordedAt: daysAgo(14),
    },
  });
}

async function createConsultationAvailability(supervisorId: string) {
  const slots = [];

  // Create upcoming slots
  for (let i = 1; i <= 3; i++) {
    const start = daysFromNow(i * 7);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(12, 0, 0, 0);

    const slot = await prisma.consultationAvailability.create({
      data: {
        supervisorId,
        startTime: start,
        endTime: end,
        slotMinutes: 30,
        meetingMode: i === 1 ? 'online' : i === 2 ? 'in-person' : 'hybrid',
        locationOrLink: i === 1 ? 'https://zoom.us/j/demo-link' : i === 2 ? 'CS Building, Room 301' : 'CS Building, Room 301 or Zoom',
        notes: 'Available for team consultations. Please prepare a brief agenda in advance — include what you want to achieve and any blockers.',
      },
    });
    slots.push(slot);
  }

  // Also create a past slot (for the past booking with meeting notes)
  const pastStart = daysAgo(10);
  pastStart.setHours(10, 0, 0, 0);
  const pastEnd = new Date(pastStart);
  pastEnd.setHours(10, 30, 0, 0);

  const pastSlot = await prisma.consultationAvailability.create({
    data: {
      supervisorId,
      startTime: pastStart,
      endTime: pastEnd,
      slotMinutes: 30,
      meetingMode: 'in-person',
      locationOrLink: 'CS Building, Room 301',
      notes: 'System design review session.',
    },
  });
  slots.push(pastSlot);

  return slots;
}

async function createConsultationBooking(
  teamId: string,
  slots: { id: string; startTime: Date }[],
  projectTitle: string,
  supervisorUserId: string
) {
  // Slot 0 = upcoming (7 days from now) — use for CONFIRMED upcoming booking
  const upcomingSlot = slots[0];
  const upcomingStart = new Date(upcomingSlot.startTime);
  const upcomingEnd = new Date(upcomingStart);
  upcomingEnd.setMinutes(upcomingEnd.getMinutes() + 30);

  const upcomingBooking = await prisma.consultationBooking.create({
    data: {
      teamId,
      availabilityId: upcomingSlot.id,
      slotStart: upcomingStart,
      slotEnd: upcomingEnd,
      status: 'CONFIRMED',
      agenda: `Review current sprint progress for ${projectTitle}. Discuss milestone 3 scope and address open questions in the Project Brain.`,
      purpose: 'We need supervisor input on two blockers: the system architecture document still has unresolved design decisions, and we are unsure whether the authentication approach chosen will scale.',
      blockerContext: 'The core API endpoints task is blocked because authentication is not complete. We are also stuck on whether to implement multi-supervisor support — we need a decision on this before we can finalise the data model.',
      topicsForSupervisor: 'Please review our updated ER diagram and confirm whether the data model is acceptable. We also want clarification on what a "complete" system design document looks like for milestone 2.',
    },
  });

  // Create consultation brief for the upcoming booking
  await prisma.consultationBrief.create({
    data: {
      bookingId: upcomingBooking.id,
      teamProgressSummary: `Project "${projectTitle}" — active progress. Milestone 1 (Proposal) complete. Milestone 2 (System Design) in progress: architecture document drafted and in review, database schema finalised. 2 overdue tasks and 2 high-priority open questions need resolution. Team has logged activity this week.`,
      suggestedAgendaItems: [
        { topic: 'Team-reported blocker: API implementation blocked by pending auth module completion', priority: 'high' },
        { topic: 'Review updated ER diagram and confirm data model approach', priority: 'high' },
        { topic: 'Resolve: single vs. multiple supervisors per team', priority: 'high' },
        { topic: 'Milestone 2 readiness check: system design document completeness criteria', priority: 'high' },
        { topic: 'Resolve: document upload size limit', priority: 'medium' },
        { topic: 'Plan for milestone 3 core implementation deliverables', priority: 'medium' },
        { topic: 'Open floor: any concerns from the team', priority: 'low' },
      ],
      risksToHighlight: [
        { risk: '2 high-priority open questions are blocking implementation decisions', severity: 'high' },
        { risk: 'Authentication module delay is causing a downstream dependency cascade', severity: 'high' },
        { risk: '2 overdue tasks indicate potential delivery risk for milestone 2', severity: 'medium' },
      ],
      unresolvedQuestions: [
        'Should the system support multiple supervisors per team, or strictly one supervisor?',
        'What is the expected file size limit for uploaded project documents?',
      ],
    },
  });

  // Slot 3 (last) = the past slot, use for COMPLETED booking with meeting notes + bridge parse
  const pastSlot = slots[slots.length - 1];
  const pastStart = new Date(pastSlot.startTime);
  const pastEnd = new Date(pastStart);
  pastEnd.setMinutes(pastEnd.getMinutes() + 30);

  const pastBooking = await prisma.consultationBooking.create({
    data: {
      teamId,
      availabilityId: pastSlot.id,
      slotStart: pastStart,
      slotEnd: pastEnd,
      status: 'COMPLETED',
      agenda: `System design and ER diagram review for ${projectTitle}.`,
      purpose: 'Get feedback on the current ER diagram and system architecture document before continuing implementation.',
      blockerContext: 'We are unsure whether the data model correctly handles the relationship between teams, projects, and tasks. The architecture document is drafted but we need confirmation before proceeding.',
    },
  });

  // Meeting notes (supervisor entered these after the meeting)
  const rawFeedback = `Overall the proposal structure is solid and I can see the team has put in good effort. However there are several areas that need to be addressed before milestone 2 can be signed off.

First, you need to revise the ER diagram. The current version has implied foreign keys that are not drawn explicitly. Make sure every relationship is drawn with cardinality notation. By the end of next week this should be complete with all entities and relationships clearly labelled.

The scope section of the requirements document needs more detail. You should ensure that the "in scope" and "out of scope" sections are specific — not just general categories. I expect to see at least 5 clearly defined in-scope features and 3 explicit out-of-scope exclusions.

Regarding the authentication approach: the current plan is fine for milestone 3, but you must make sure the session handling is secure. As you know, the university has strict data privacy requirements for student systems. Please confirm this has been considered in the design.

The architecture document needs to demonstrate that the team understands the deployment environment. I want to see a deployment diagram included. This should show the frontend, backend, and database tiers clearly. Obviously the cloud provider choice should also be documented.

For next time, please ensure all open questions in your project brain are updated. I noticed two questions that I answered verbally today — please update those resolutions now. 

The quality of work is improving. I expect to see the revised ER diagram and updated scope document at our next session in approximately two weeks.`;

  await prisma.meetingNote.create({
    data: {
      bookingId: pastBooking.id,
      authorId: supervisorUserId,
      content: rawFeedback,
    },
  });

  // Bridge parse (generated from the raw feedback)
  await prisma.supervisorFeedbackParse.create({
    data: {
      bookingId: pastBooking.id,
      rawFeedback,
      actionItems: [
        {
          title: 'Revise the ER diagram with explicit foreign key relationships and cardinality notation',
          suggestedOwnerLabel: 'Developer',
          priority: 'high',
          dueHint: 'By end of next week',
          riskIfIgnored: 'Supervisor will notice this at the next review.',
          whatGoodLooksLike: 'A complete diagram with all entities, relationships, and FK labels shown.',
        },
        {
          title: 'Revise the scope section of the requirements document with specific in-scope and out-of-scope items',
          suggestedOwnerLabel: 'Team Lead',
          priority: 'high',
          dueHint: 'Before next session',
          riskIfIgnored: 'Milestone 2 cannot be signed off without this.',
          whatGoodLooksLike: 'At least 5 in-scope features and 3 explicit out-of-scope exclusions, each clearly described.',
        },
        {
          title: 'Confirm that session handling in the authentication design meets university privacy requirements',
          suggestedOwnerLabel: 'Developer',
          priority: 'high',
          dueHint: null,
          riskIfIgnored: 'May affect project grade or deadline compliance.',
          whatGoodLooksLike: 'A documented note in the architecture document confirming the privacy approach used.',
        },
        {
          title: 'Add a deployment diagram to the architecture document showing frontend, backend, and database tiers',
          suggestedOwnerLabel: 'Whole Team',
          priority: 'medium',
          dueHint: 'Before next session',
          riskIfIgnored: 'Supervisor will notice this at the next review.',
          whatGoodLooksLike: 'A clear diagram with all three tiers labelled, cloud provider documented.',
        },
        {
          title: 'Update Project Brain with resolutions to the two questions answered verbally in the meeting',
          suggestedOwnerLabel: 'Team Lead',
          priority: 'high',
          dueHint: 'Immediately',
          riskIfIgnored: 'Decisions will be lost and the team will lack shared context.',
          whatGoodLooksLike: 'Both questions marked as resolved with a clear written resolution in Project Brain.',
        },
      ],
      expectations: [
        'I expect to see at least 5 clearly defined in-scope features and 3 explicit out-of-scope exclusions.',
        'I want to see a deployment diagram included in the architecture document.',
        'I expect to see the revised ER diagram and updated scope document at the next session.',
      ],
      ambiguities: [
        'The deadline "approximately two weeks" is vague — clarify the exact date with your supervisor.',
        'Strict data privacy requirements were mentioned — confirm what specific requirements apply.',
      ],
      hiddenAssumptions: [
        '"As you know, the university has strict data privacy requirements" — Supervisor assumed: you already know this context. Verify all team members are aware of these requirements.',
        '"Obviously the cloud provider choice should also be documented" — Supervisor used "obviously" — may not be obvious to everyone on the team. Discuss as a team to confirm everyone understands what is needed.',
      ],
      qualityExpectations: [
        { area: 'Requirements Documentation', standard: 'At least 5 clearly defined in-scope features and 3 explicit out-of-scope exclusions.', example: null },
        { area: 'ER Diagram', standard: 'All entities and relationships labelled with cardinality notation. No implied foreign keys.', example: null },
        { area: 'Architecture Document', standard: 'Must include a deployment diagram showing frontend, backend, and database tiers. Cloud provider documented.', example: null },
      ],
      deadlineWarnings: [
        { text: 'By the end of next week this should be complete', urgencyLevel: 'high', extractedDate: 'By end of next week' },
        { text: 'approximately two weeks', urgencyLevel: 'medium', extractedDate: 'Approximately 2 weeks (exact date unclear — confirm)' },
      ],
      suggestedFirstSteps: [
        'Revise the ER diagram with explicit foreign key relationships and cardinality notation',
        'Update Project Brain with resolutions to the two questions answered verbally in the meeting',
        'Revise the scope section of the requirements document with specific in-scope and out-of-scope items',
      ],
      studentSummary: 'Your supervisor gave 5 clear action items for the team to work on. There are 2 timeline mentions in the feedback — check the deadline warnings below carefully. 2 points in the feedback are unclear — these are listed as things to clarify at your next consultation. 2 hidden assumptions were detected — make sure the whole team is aligned on these.',
      clarityScore: 0.72,
      parsedBy: 'seed-v1',
    },
  });

  return upcomingBooking;
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
