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

export const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'HYBRID', 'ELECTRIC'] as const;
export const TRANSMISSION_TYPES = ['MANUAL', 'AUTOMATIC', 'AMT', 'CVT'] as const;

export const MIN_MANUFACTURING_YEAR = 1900;
export const MAX_ODOMETER_KM = 2_000_000;

/** Indian plates are stored trimmed, uppercased and single-spaced: `mh 12 ab 1234` → `MH 12 AB 1234`. */
export function normalizeRegistrationNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function isRealIsoDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) {
    return false;
  }
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Optional column shared by every nullable vehicle field: an absent key or an
 * empty string means "not provided" (undefined), while an explicit null means
 * "clear this field" — which is how PATCH distinguishes the two.
 */
function optionalString<T extends string>(schema: z.ZodType<T>) {
  return z.preprocess(emptyToUndefined, schema.nullable().optional());
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const registrationNumberSchema = z
  .string()
  .transform(normalizeRegistrationNumber)
  .refine(
    (value) => /^[A-Z0-9][A-Z0-9 \-]{4,19}$/.test(value),
    'Use 5-20 letters, digits, spaces or hyphens',
  );

const isoDateSchema = z
  .string()
  .refine(isRealIsoDate, 'Expected a real calendar date as YYYY-MM-DD')
  .refine(
    (value) => value <= todayIsoDate(),
    'Purchase date cannot be in the future',
  );

export const createVehicleSchema = z.object({
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  variant: optionalString(z.string().trim().min(1).max(50)),
  manufacturingYear: z.coerce
    .number()
    .int('Manufacturing year must be a whole number')
    .min(MIN_MANUFACTURING_YEAR, `Manufacturing year cannot be before ${MIN_MANUFACTURING_YEAR}`)
    .max(
      new Date().getFullYear() + 1,
      'Manufacturing year cannot be more than a year ahead',
    ),
  fuelType: z.enum(FUEL_TYPES),
  transmission: z.enum(TRANSMISSION_TYPES),
  registrationNumber: optionalString(registrationNumberSchema),
  purchaseDate: optionalString(isoDateSchema),
  currentOdometer: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int('Odometer must be a whole number of kilometres')
      .min(0, 'Odometer cannot be negative')
      .max(MAX_ODOMETER_KM, `Odometer cannot exceed ${MAX_ODOMETER_KM} km`)
      .nullable()
      .optional(),
  ),
});

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update',
  );

export const vehicleIdSchema = z.string().uuid('Vehicle id must be a UUID');

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type FuelTypeInput = z.infer<typeof createVehicleSchema>['fuelType'];
export type TransmissionInput = z.infer<typeof createVehicleSchema>['transmission'];
