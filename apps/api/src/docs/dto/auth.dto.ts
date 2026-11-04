import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * These classes document payloads only. Validation still lives entirely in
 * `@autogenius/validation`, so nothing here can disagree with the Zod schemas;
 * `docs-example-contract.spec.ts` fails if an example stops validating.
 */

export const registerInputExample = {
  name: 'Jitendra Maurya',
  email: 'jitendra@example.com',
  phone: '+91 98765 43210',
  password: 'S3curePass',
} as const;

export const loginInputExample = {
  email: 'jitendra@example.com',
  password: 'S3curePass',
} as const;

export const refreshTokenExample = {
  refreshToken: '2f4a1c6b-8d9e-4f0a-b1c2-d3e4f5a6b7c8',
} as const;

export class RegisterInputDto {
  @ApiProperty({
    description: 'Display name of the account holder.',
    maxLength: 100,
    example: registerInputExample.name,
  })
  name!: string;

  @ApiProperty({
    description: 'Sign-in address. Surrounding whitespace is trimmed.',
    format: 'email',
    maxLength: 255,
    example: registerInputExample.email,
  })
  email!: string;

  @ApiPropertyOptional({
    description:
      'Optional contact number. Spaces, dots, hyphens and parentheses are stripped before validation, so "+91 98765 43210" and "+919876543210" are equivalent.',
    example: registerInputExample.phone,
    pattern: '^\\+?[0-9]{8,15}$',
    type: String,
  })
  phone?: string;

  @ApiProperty({
    description: 'Account password. Stored only as a bcrypt hash.',
    minLength: 8,
    maxLength: 72,
    format: 'password',
    example: registerInputExample.password,
  })
  password!: string;
}

export class LoginInputDto {
  @ApiProperty({
    description: 'Sign-in address, matched case-insensitively.',
    format: 'email',
    maxLength: 255,
    example: loginInputExample.email,
  })
  email!: string;

  @ApiProperty({
    description: 'Account password, compared against the stored bcrypt hash.',
    maxLength: 72,
    format: 'password',
    example: loginInputExample.password,
  })
  password!: string;
}

export class RefreshInputDto {
  @ApiProperty({
    description: 'The refresh token returned by register, login or a previous refresh.',
    example: refreshTokenExample.refreshToken,
  })
  refreshToken!: string;
}

export class AuthTokensDto {
  @ApiProperty({
    description: 'Short-lived HS256 JWT sent as `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZjkj...',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'Opaque single-use token. Only its SHA-256 hash is stored; presenting a rotated value revokes the session family.',
    example: refreshTokenExample.refreshToken,
  })
  refreshToken!: string;
}

export class PublicUserDto {
  @ApiProperty({ format: 'uuid', example: '3f9c1e2a-7b4d-4e51-9a3f-6c2d8e1b0a55' })
  id!: string;

  @ApiProperty({ example: registerInputExample.name })
  name!: string;

  @ApiProperty({ format: 'email', example: registerInputExample.email })
  email!: string;

  @ApiProperty({
    nullable: true,
    description: 'Canonical digits, or null when the user did not provide a phone.',
    example: '+919876543210',
    type: String,
  })
  phone!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-11-04T05:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', example: '2026-11-04T05:30:00.000Z' })
  updatedAt!: Date;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable reason. Validation failures are reported as `field: message`, joined with "; ".',
    example: 'email: Invalid email',
  })
  message!: string;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
