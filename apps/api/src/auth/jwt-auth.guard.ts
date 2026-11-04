import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '@autogenius/validation';
import { ENV } from '../config/config.module';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ACCESS_TOKEN_ALGORITHM } from './tokens.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authorization.slice('Bearer '.length).trim();
    let payload: { sub?: string; email?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.env.JWT_ACCESS_SECRET,
        algorithms: [ACCESS_TOKEN_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = { id: payload.sub, email: payload.email };
    return true;
  }
}
