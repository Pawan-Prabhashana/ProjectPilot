import { prisma } from "@/lib/db";
import type { CreateUserInput, UserId, UserSummary } from "@/lib/types/domain";

function toSummary(user: {
  id: string;
  email: string;
  name: string;
  role: UserSummary["role"];
}): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function findUserById(id: UserId): Promise<UserSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
  return user ? toSummary(user) : null;
}

export async function findUserByEmail(
  email: string,
): Promise<UserSummary | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  });
  return user ? toSummary(user) : null;
}

export async function createUser(input: CreateUserInput): Promise<UserSummary> {
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  return toSummary(user);
}
