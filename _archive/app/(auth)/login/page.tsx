'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';
import { Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const result = await signIn('credentials', {
      email: data.email.toLowerCase(),
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password. Please check your credentials and try again.');
      return;
    }

    // Redirect to the unified overview — the page itself is role-aware
    router.push('/dashboard/overview');
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-xl">
        <h1 className="text-xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/50">Sign in to your ProjectPilot Neuro account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-white/70">
                Password
              </label>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sky-400"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
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
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/40">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-sky-400 hover:text-sky-300">
            Register here
          </Link>
        </p>

        {/* Demo credentials helper — remove in production */}
        <div className="mt-6 rounded-lg bg-sky-500/10 border border-sky-500/20 p-3">
          <p className="text-xs font-medium text-sky-300 mb-1">Demo accounts</p>
          <p className="text-xs text-white/50">Student: aisha@demo.com / demo1234</p>
          <p className="text-xs text-white/50">Supervisor: dr.perera@demo.com / demo1234</p>
          <p className="text-xs text-white/50">Coordinator: coord@demo.com / demo1234</p>
        </div>
      </div>
    </div>
  );
}
