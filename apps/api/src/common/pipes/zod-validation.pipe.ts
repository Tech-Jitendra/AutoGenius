import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => {
          // Whole-value schemas (e.g. a single param) have no path to name.
          const field = issue.path.join('.');
          return field ? `${field}: ${issue.message}` : issue.message;
        })
        .join('; ');
      throw new BadRequestException(message);
    }
    return result.data;
  }
}
