import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { registerSchema } from '@/lib/validations/auth';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;
    const normalised = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalised } });
    if (existing) {
      return NextResponse.json(
        { message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        email: normalised,
        name,
        role,
        passwordHash,
        // Create the role-specific profile in the same transaction
        studentProfile: role === 'STUDENT' ? { create: {} } : undefined,
        supervisorProfile: role === 'SUPERVISOR' ? { create: {} } : undefined,
        coordinatorProfile: role === 'COORDINATOR' ? { create: {} } : undefined,
        // Default accessibility settings for every new user
        accessibilitySetting: { create: {} },
      },
    });

    log.info('auth.register.success', { role });
    return NextResponse.json({ message: 'Account created successfully.' }, { status: 201 });
  } catch (error) {
    log.error('auth.register.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
