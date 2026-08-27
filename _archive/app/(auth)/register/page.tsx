'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';
import { Loader2, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setError(null);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? 'Registration failed. Please try again.');
      return;
    }

    router.push('/login?registered=1');
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-xl">
        <h1 className="text-xl font-bold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-white/50">
          Join ProjectPilot Neuro. Your cognitive profile will be set up after registration.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white/70 mb-1">
              Full name
            </label>
            <Input
              id="name"
              placeholder="Aisha Fernando"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@university.edu"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-white/70 mb-1">
              I am a…
            </label>
            <select
              id="role"
              className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              {...register('role')}
            >
              <option value="STUDENT" className="bg-slate-800">Student</option>
              <option value="SUPERVISOR" className="bg-slate-800">Supervisor / Lecturer</option>
              <option value="COORDINATOR" className="bg-slate-800">Coordinator / Admin</option>
            </select>
            {errors.role && <p className="mt-1 text-xs text-red-400">{errors.role.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/70 mb-1">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
