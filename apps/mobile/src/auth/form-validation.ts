import type { ZodType, ZodTypeDef } from 'zod';

export type FieldErrors = Record<string, string | undefined>;

export type FormValidationResult<T> =
  | { success: true; values: T }
  | { success: false; errors: FieldErrors };

// The input position is pinned to `unknown` so T is inferred from the schema's
// output type, which is what a submit handler needs.
export function validateForm<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  input: unknown,
): FormValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, values: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    if (!errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
