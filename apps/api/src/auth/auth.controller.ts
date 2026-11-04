import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Env } from '@autogenius/validation';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  type LoginInput,
  type LogoutInput,
  type RefreshInput,
  type RegisterInput,
} from '@autogenius/validation';
import { ENV } from '../config/config.module';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AuthResponseDto,
  AuthTokensDto,
  ErrorResponseDto,
  LoginInputDto,
  PublicUserDto,
  RefreshInputDto,
  RegisterInputDto,
} from '../docs/dto/auth.dto';
import { AuthService, AuthResponse, PublicUser } from './auth.service';
import { AuthTokens } from './tokens.service';

const rateLimitTtl = () => Number(process.env['RATE_LIMIT_TTL_MS'] ?? 60000);

function ValidationFailed(description: string) {
  return ApiResponse({
    status: 400,
    description,
    type: ErrorResponseDto,
  });
}

function TooManyRequestsResponse(limit: string) {
  return ApiResponse({
    status: 429,
    description: `Rate limit exceeded: ${limit} per RATE_LIMIT_TTL_MS window per IP. Reduce the request frequency.`,
    type: ErrorResponseDto,
  });
}

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({
  auth: {
    limit: () => Number(process.env['RATE_LIMIT_AUTH_MAX'] ?? 5),
    ttl: rateLimitTtl,
  },
})
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an account and sign in' })
  @ApiBody({ type: RegisterInputDto, description: 'New account details.' })
  @ApiCreatedResponse({
    description:
      'Account created. The access token is valid immediately, so no separate login call is needed.',
    type: AuthResponseDto,
  })
  @ValidationFailed(
    'name, email, phone or password failed validation. `message` lists each failure as `field: message`.',
  )
  @ApiResponse({
    status: 409,
    description: 'An account already exists for this email (compared case-insensitively).',
    type: ErrorResponseDto,
  })
  @TooManyRequestsResponse('RATE_LIMIT_AUTH_MAX requests')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  @ApiBody({ type: LoginInputDto })
  @ApiOkResponse({
    description: 'Credentials accepted; a fresh token pair is issued.',
    type: AuthResponseDto,
  })
  @ValidationFailed('email or password failed validation.')
  @ApiResponse({
    status: 401,
    description:
      'Unknown address or wrong password. The two cases share one message so the endpoint cannot be used to confirm that an email is registered.',
    type: ErrorResponseDto,
  })
  @TooManyRequestsResponse('RATE_LIMIT_AUTH_MAX requests')
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiBody({ type: RefreshInputDto })
  @ApiOkResponse({
    description:
      'A new token pair. The presented refresh token is rotated, and reusing a previously presented value revokes the session.',
    type: AuthTokensDto,
  })
  @ValidationFailed('refreshToken is missing or empty.')
  @ApiResponse({
    status: 401,
    description: 'Refresh token unknown, already rotated, revoked, or expired.',
    type: ErrorResponseDto,
  })
  @TooManyRequestsResponse('RATE_LIMIT_REFRESH_MAX requests')
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiBody({ type: RefreshInputDto })
  @ApiNoContentResponse({
    description: 'Refresh token revoked. The access token still lives until it expires.',
  })
  @ValidationFailed('refreshToken is missing or empty.')
  @ApiResponse({
    status: 401,
    description: 'Refresh token unknown, already rotated, or revoked.',
    type: ErrorResponseDto,
  })
  @TooManyRequestsResponse('RATE_LIMIT_AUTH_MAX requests')
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in user' })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({
    description: 'The user the bearer token belongs to.',
    type: PublicUserDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Access token missing, malformed, or expired.',
    type: ErrorResponseDto,
  })
  me(@CurrentUser() user: CurrentUserPayload): Promise<PublicUser> {
    return this.auth.getMe(user.id);
  }
}
