/**
 * Phase 1 seed — idempotent demo users, one team, one project.
 */
import { hash } from "bcryptjs";
import { PrismaClient, Role, TaskPriority, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await hash("demo1234", 12);

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@demo.com" },
    update: {},
    create: {
      email: "supervisor@demo.com",
      name: "Demo Supervisor",
      passwordHash,
      role: Role.SUPERVISOR,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@demo.com" },
    update: {},
    create: {
      email: "student@demo.com",
      name: "Demo Student",
      passwordHash,
      role: Role.STUDENT,
    },
  });

  const team =
    (await prisma.team.findFirst({
      where: { name: "Capstone Team Alpha", supervisorId: supervisor.id },
    })) ??
    (await prisma.team.create({
      data: {
        name: "Capstone Team Alpha",
        supervisorId: supervisor.id,
      },
    }));

  await prisma.teamMember.upsert({
    where: {
      userId_teamId: {
        userId: student.id,
        teamId: team.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      teamId: team.id,
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: { teamId: team.id, title: "Year-long Capstone Project" },
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        title: "Year-long Capstone Project",
        description: "Foundational project record for Phase 1 of ProjectPilot.",
        teamId: team.id,
      },
    }));

  const demoTasks: Array<{ title: string; description: string; status: TaskStatus }> = [
    {
      title: "Draft literature review",
      description: "Summarise related work for the first milestone.",
      status: TaskStatus.IN_PROGRESS,
    },
    {
      title: "Set up project repository",
      description: "Create the shared GitHub repo and branch protection.",
      status: TaskStatus.TODO,
    },
    {
      title: "Define evaluation metrics",
      description: "Backlog item for later in the semester.",
      status: TaskStatus.BACKLOG,
    },
  ];

  for (const task of demoTasks) {
    const exists = await prisma.task.findFirst({
      where: { projectId: project.id, title: task.title },
    });
    if (!exists) {
      await prisma.task.create({
        data: {
          ...task,
          projectId: project.id,
          assigneeId: student.id,
          priority: TaskPriority.MEDIUM,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
