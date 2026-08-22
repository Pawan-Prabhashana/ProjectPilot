import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const PASSWORD_MIN = 10;
const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890',
  'qwerty123', 'iloveyou', 'admin1234', 'letmein1', 'welcome1',
]);

export const registerSchema = z
  .object({
    email: z
      .string()
      .email('Valid email required')
      .max(254, 'Email too long')
      .transform((v) => v.toLowerCase().trim()),
    password: z
      .string()
      .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
      .max(128, 'Password too long')
      .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
      .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter')
      .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number')
      .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'Password is too common'),
    confirmPassword: z.string(),
    name: z.string().min(1, 'Name required').max(100, 'Name too long').trim(),
    // Self-registration is restricted to STUDENT only.
    // SUPERVISOR and COORDINATOR accounts are provisioned by administrators.
    role: z.literal('STUDENT'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
