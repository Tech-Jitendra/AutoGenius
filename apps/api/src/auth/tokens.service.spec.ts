import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '@autogenius/validation';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ACCESS_TOKEN_ALGORITHM,
  TokensService,
  durationToMs,
} from './tokens.service';
import type { RefreshTokenEntity } from '../refresh-tokens/refresh-token.entity';
import { hashRefreshToken } from '../refresh-tokens/token-hash';
import type { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import type { UserEntity } from '../users/user.entity';

describe('durationToMs', () => {
  it('parses supported units', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('2h')).toBe(7_200_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
    expect(durationToMs('1w')).toBe(604_800_000);
  });

  it('rejects malformed durations', () => {
    expect(() => durationToMs('15')).toThrow();
    expect(() => durationToMs('abc')).toThrow();
    expect(() => durationToMs('15x')).toThrow();
  });
});

const env = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
} as Env;

interface CreateInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

function tokenRow(overrides: Partial<RefreshTokenEntity> = {}) {
  return {
    id: 'row-1',
    userId: 'user-1',
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedById: null,
    ...overrides,
  } as RefreshTokenEntity;
}

function makeService(row: RefreshTokenEntity | null) {
  const calls: string[] = [];
  const created: CreateInput[] = [];
  const claimed: Array<{ oldId: string; replacedById: string }> = [];
  const revokedUsers: string[] = [];

  const sign = jest.fn(() => 'access-token');
  const refreshTokens = {
    findByPresentedToken: jest.fn(async () => row),
    create: jest.fn(async (input: CreateInput) => {
      created.push(input);
      calls.push('create');
      return tokenRow({ id: 'row-2' });
    }),
    claim: jest.fn(async (oldId: string, replacedById: string) => {
      claimed.push({ oldId, replacedById });
      calls.push('claim');
      return true;
    }),
    revoke: jest.fn(async () => undefined),
    revokeAllForUser: jest.fn(async (userId: string) => {
      revokedUsers.push(userId);
    }),
  };
  const service = new TokensService(
    { sign } as unknown as JwtService,
    refreshTokens as unknown as RefreshTokensService,
    env,
  );
  return {
    service,
    sign,
    refreshTokens,
    calls,
    created,
    claimed,
    revokedUsers,
  };
}

describe('TokensService', () => {
  const user = { id: 'user-1', email: 'user@example.com' } as UserEntity;

  it('signs access tokens with the pinned HS256 algorithm', async () => {
    const { service, sign } = makeService(null);
    await service.issueTokenPair(user);
    expect(sign).toHaveBeenCalledWith(
      { sub: 'user-1', email: 'user@example.com' },
      expect.objectContaining({
        algorithm: ACCESS_TOKEN_ALGORITHM,
        expiresIn: '15m',
      }),
    );
  });

  it('stores only the hash and expiry of a new refresh token', async () => {
    const { service, created } = makeService(null);
    const { refreshToken } = await service.issueTokenPair(user);

    expect(created).toHaveLength(1);
    const row = created[0];
    expect(row?.tokenHash).toBe(hashRefreshToken(refreshToken));
    expect(row?.tokenHash).toHaveLength(64);
    expect(row?.tokenHash).not.toBe(refreshToken);
    expect(row?.userId).toBe('user-1');
    expect(row?.id).toEqual(expect.any(String));
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('inserts the replacement before claiming the presented token', async () => {
    const { service, calls, claimed, created } = makeService(tokenRow());
    const result = await service.rotateRefreshToken('presented');

    expect(calls).toEqual(['create', 'claim']);
    expect(claimed[0]?.oldId).toBe('row-1');
    expect(created[0]?.id).toBe(claimed[0]?.replacedById);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).not.toBe('presented');
  });

  it('treats a lost claim as reuse and revokes every session', async () => {
    const { service, refreshTokens, revokedUsers } = makeService(tokenRow());
    refreshTokens.claim.mockResolvedValue(false);

    await expect(
      service.rotateRefreshToken('presented'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revokedUsers).toEqual(['user-1']);
  });

  it('revokes every session when a revoked token is presented again', async () => {
    const { service, refreshTokens, revokedUsers } = makeService(
      tokenRow({ revokedAt: new Date() }),
    );

    await expect(
      service.rotateRefreshToken('presented'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokens.create).not.toHaveBeenCalled();
    expect(revokedUsers).toEqual(['user-1']);
  });

  it('rejects an expired token without touching the family', async () => {
    const { service, revokedUsers } = makeService(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.rotateRefreshToken('presented'),
    ).rejects.toThrow('Refresh token expired');
    expect(revokedUsers).toEqual([]);
  });

  it('rejects a token that has no row at all', async () => {
    const { service } = makeService(null);
    await expect(
      service.rotateRefreshToken('presented'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes only the presented token on logout', async () => {
    const row = tokenRow();
    const { service, refreshTokens, revokedUsers } = makeService(row);
    await service.revokeRefreshToken('presented');
    expect(refreshTokens.revoke).toHaveBeenCalledWith(row);
    expect(revokedUsers).toEqual([]);
  });

  it('is a no-op on logout for an already revoked token', async () => {
    const { service, refreshTokens } = makeService(
      tokenRow({ revokedAt: new Date() }),
    );
    await service.revokeRefreshToken('presented');
    expect(refreshTokens.revoke).not.toHaveBeenCalled();
  });
});

function guardFor(
  verifyAsync: (token: string, options: unknown) => Promise<unknown>,
) {
  return new JwtAuthGuard(
    { verifyAsync } as unknown as JwtService,
    { getAllAndOverride: () => false } as never,
    env,
  );
}

function httpContext(authorization?: string) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  } as never;
}

describe('JwtAuthGuard', () => {
  it('verifies only with the pinned algorithm', async () => {
    const verifyAsync = jest.fn(async () => ({ sub: 'user-1' }) as unknown);
    const guard = new JwtAuthGuard(
      { verifyAsync } as unknown as JwtService,
      { getAllAndOverride: () => false } as never,
      env,
    );
    await expect(
      guard.canActivate(httpContext('Bearer good-token')),
    ).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith(
      'good-token',
      expect.objectContaining({ algorithms: [ACCESS_TOKEN_ALGORITHM] }),
    );
  });

  it('accepts a valid bearer token and stores only the public claims', async () => {
    const guard = guardFor(async () => ({ sub: 'user-1', email: 'a@b.c' }));
    const request: {
      headers: Record<string, string>;
      user?: { id: string; email?: string };
    } = { headers: { authorization: 'Bearer good-token' } };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'a@b.c' });
  });

  it('rejects a missing bearer token', async () => {
    await expect(
      guardFor(async () => ({})).canActivate(httpContext()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token the verifier refuses', async () => {
    const guard = guardFor(async () => {
      throw new Error('bad signature');
    });
    await expect(
      guard.canActivate(httpContext('Bearer whatever')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a verified token without a subject', async () => {
    await expect(
      guardFor(async () => ({})).canActivate(httpContext('Bearer whatever')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips verification for public routes', async () => {
    let called = false;
    const guard = new JwtAuthGuard(
      {
        verifyAsync: async () => {
          called = true;
          return {};
        },
      } as unknown as JwtService,
      { getAllAndOverride: () => true } as never,
      env,
    );
    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
    expect(called).toBe(false);
  });
});
