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

    // Role is always STUDENT from self-registration (enforced by schema).
    // SUPERVISOR and COORDINATOR accounts are provisioned by administrators only.
    const { email, password, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Return 200 with a generic message to prevent email enumeration.
      // The client shows the same "check your inbox" message regardless.
      log.warn('auth.register.duplicate', { email });
      return NextResponse.json(
        { message: 'If this email is not already registered, your account has been created.' },
        { status: 200 }
      );
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash,
        studentProfile: { create: {} },
        accessibilitySetting: { create: {} },
      },
    });

    log.info('auth.register.success', { role });
    return NextResponse.json(
      { message: 'If this email is not already registered, your account has been created.' },
      { status: 201 }
    );
  } catch (error) {
    log.error('auth.register.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
