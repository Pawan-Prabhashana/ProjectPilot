import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import {
  upsertProfileDraft,
  upsertSkills,
  upsertRolePreferences,
  upsertAvailability,
  submitFormationProfile,
  getFormationProfileForUser,
  type SkillInput,
  type RolePreferenceInput,
  type AvailabilityInput,
} from '@/lib/services/formation/student-profile';
import { log } from '@/lib/logger';

/** GET /api/formation-profile — fetch current student's profile */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only students have a formation profile.' }, { status: 403 });
    }
    const { studentProfileId, profile } = await getFormationProfileForUser(user.id);
    if (!studentProfileId) {
      return NextResponse.json({ message: 'Student profile not found.' }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ message: 'Failed to load profile.' }, { status: 500 });
  }
}

/**
 * POST /api/formation-profile
 * Body: { action: 'save_draft' | 'save_skills' | 'save_roles' | 'save_availability' | 'submit', ...data }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only students can edit a formation profile.' }, { status: 403 });
    }

    const sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!sp) {
      return NextResponse.json({ message: 'Student profile not found. Contact your coordinator.' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'save_draft') {
      const profile = await upsertProfileDraft(sp.id, body);
      log.info('formation-profile.draft.saved', { userId: user.id });
      return NextResponse.json({ profile });
    }

    // For sub-section saves, we need the profile id
    const existing = await prisma.studentFormationProfile.findUnique({
      where: { studentProfileId: sp.id },
      select: { id: true },
    });
    if (!existing) {
      // Auto-create a draft first
      await upsertProfileDraft(sp.id, {});
    }
    const profileRecord = await prisma.studentFormationProfile.findUniqueOrThrow({
      where: { studentProfileId: sp.id },
      select: { id: true },
    });

    if (action === 'save_skills') {
      await upsertSkills(profileRecord.id, body.skills as SkillInput[]);
      log.info('formation-profile.skills.saved', { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (action === 'save_roles') {
      await upsertRolePreferences(profileRecord.id, body.roles as RolePreferenceInput[]);
      log.info('formation-profile.roles.saved', { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (action === 'save_availability') {
      await upsertAvailability(profileRecord.id, body.slots as AvailabilityInput[]);
      log.info('formation-profile.availability.saved', { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (action === 'submit') {
      const profile = await submitFormationProfile(sp.id);
      log.info('formation-profile.submitted', { userId: user.id });
      return NextResponse.json({ profile });
    }

    return NextResponse.json({ message: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    log.error('formation-profile.save.failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: 'Failed to save profile.' }, { status: 500 });
  }
}
