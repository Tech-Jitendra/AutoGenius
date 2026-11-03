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
import { AuthService, AuthResponse, PublicUser } from './auth.service';
import { AuthTokens } from './tokens.service';

const rateLimitTtl = () => Number(process.env['RATE_LIMIT_TTL_MS'] ?? 60000);

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
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({
    auth: {
      limit: () => Number(process.env['RATE_LIMIT_REFRESH_MAX'] ?? 10),
      ttl: rateLimitTtl,
    },
  })
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload): Promise<PublicUser> {
    return this.auth.getMe(user.id);
  }
}
