import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown =>
  value === '' ? undefined : value;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  ADMIN_PORT: z.coerce.number().int().positive().default(3002),
  AI_SERVICE_PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(10),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  // Optional until the AI tasks: an unset key must not block the rest of the
  // stack, but a present value is still validated.
  QWEN_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  QWEN_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  return envSchema.parse(input);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const phoneRegex = /^\+?[0-9]{8,15}$/;

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().regex(phoneRegex).optional(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
