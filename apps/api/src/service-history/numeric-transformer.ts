import type { ValueTransformer } from 'typeorm';

/**
 * pg hands NUMERIC back as a string to preserve precision. These columns are
 * money, not arbitrary-precision arithmetic, so the API narrows them to a JS
 * number on the way out and leaves the number untouched on the way in.
 * Values are always written with at most two decimals — the shared Zod schema
 * rounds them — so the round trip cannot drift.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value: string): number => Number(value),
};
