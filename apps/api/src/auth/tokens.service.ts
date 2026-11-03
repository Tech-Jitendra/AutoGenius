import { randomBytes } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { Env } from '@autogenius/validation';
import { ENV } from '../config/config.module';
import type { UserEntity } from '../users/user.entity';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import type { RefreshTokenEntity } from '../refresh-tokens/refresh-token.entity';
import { hashRefreshToken } from '../refresh-tokens/token-hash';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const durationPattern = /^(\d+)(s|m|h|d|w)$/;

export function durationToMs(duration: string): number {
  const match = durationPattern.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number(match[1]);
  const multipliers = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  } as const;
  const unit = match[2] as keyof typeof multipliers;
  return value * multipliers[unit];
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issueTokenPair(user: UserEntity): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(user.id, user.email);
    const { token: refreshToken } = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(presentedToken: string): Promise<AuthTokens> {
    const existing = await this.findActiveOrFail(presentedToken);

    const { token: newRefreshToken, entity: newRow } =
      await this.createRefreshToken(existing.userId);
    await this.refreshTokens.revoke(existing, newRow.id);

    const accessToken = this.signAccessToken(existing.userId);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const row = await this.refreshTokens.findByPresentedToken(presentedToken);
    if (!row || row.revokedAt) {
      return;
    }
    await this.refreshTokens.revoke(row);
  }

  private signAccessToken(sub: string, email?: string): string {
    return this.jwt.sign(
      email ? { sub, email } : { sub },
      {
        secret: this.env.JWT_ACCESS_SECRET,
        expiresIn: this.env.JWT_ACCESS_EXPIRES_IN,
      } as JwtSignOptions,
    );
  }

  private async createRefreshToken(
    userId: string,
  ): Promise<{ token: string; entity: RefreshTokenEntity }> {
    const token = randomBytes(48).toString('base64url');
    const entity = await this.refreshTokens.create({
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(
        Date.now() + durationToMs(this.env.JWT_REFRESH_EXPIRES_IN),
      ),
    });
    return { token, entity };
  }

  private async findActiveOrFail(
    presentedToken: string,
  ): Promise<RefreshTokenEntity> {
    const row = await this.refreshTokens.findByPresentedToken(presentedToken);
    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.revokedAt) {
      // A revoked token presented again means a rotated token is being reused
      // or post-logout traffic — revoke the user's whole session set.
      await this.refreshTokens.revokeAllForUser(row.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    return row;
  }
}
