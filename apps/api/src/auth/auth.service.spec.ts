import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AuthService, toPublicUser } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { TokensService } from './tokens.service';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/user.entity';

// TypeORM copies the driver's SQLSTATE onto QueryFailedError, which is what
// the register path keys on.
function pgFailure(code: string, constraint?: string): QueryFailedError {
  return new QueryFailedError(
    'INSERT INTO "users" ...',
    [],
    Object.assign(new Error(`duplicate key for ${constraint ?? code}`), {
      code,
      constraint,
    }),
  );
}

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {  return {
    id: 'user-1',
    name: 'Jitendra',
    email: 'user@example.com',
    phone: null,
    passwordHash: 'hashed',
    createdAt: new Date('2026-10-05T00:00:00Z'),
    updatedAt: new Date('2026-10-05T00:00:00Z'),
    ...overrides,
  } as UserEntity;
}

describe('AuthService', () => {
  let users: jest.Mocked<Pick<UsersService, keyof UsersService>>;
  let passwordHasher: jest.Mocked<Pick<PasswordHasher, 'hash' | 'compare'>>;
  let tokens: jest.Mocked<Pick<TokensService, 'issueTokenPair'>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
      existsByEmail: jest.fn(),
    };
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    tokens = { issueTokenPair: jest.fn() };
    service = new AuthService(
      users as unknown as UsersService,
      passwordHasher as unknown as PasswordHasher,
      tokens as unknown as TokensService,
    );
  });

  describe('register', () => {
    const input = {
      name: 'Jitendra',
      email: 'User@Example.com',
      password: 'password123',
    };

    it('creates a hashed user and returns tokens without the password hash', async () => {
      users.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed-password');
      const saved = makeUser();
      users.create.mockResolvedValue(saved);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      const result = await service.register(input);

      expect(passwordHasher.hash).toHaveBeenCalledWith('password123');
      expect(result.user).toEqual(toPublicUser(saved));
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('hashed-password');
    });

    it('rejects a duplicate email with a conflict', async () => {
      users.existsByEmail.mockResolvedValue(true);
      await expect(service.register(input)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });

    it('maps a PostgreSQL 23505 from a racing insert to a conflict', async () => {
      // The pre-check saw no row; a parallel transaction inserted first.
      users.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed-password');
      users.create.mockRejectedValue(pgFailure('23505', 'users_email_unique'));
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      await expect(service.register(input)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tokens.issueTokenPair).not.toHaveBeenCalled();
    });

    it('rethrows a database failure that is not a unique violation', async () => {
      users.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed-password');
      users.create.mockRejectedValue(pgFailure('23503'));

      await expect(service.register(input)).rejects.toMatchObject({
        code: '23503',
      });
      await expect(service.register(input)).rejects.not.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('logs in with a correct password', async () => {
      const user = makeUser();
      users.findByEmailWithPassword.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('user@example.com');
      expect(JSON.stringify(result)).not.toContain('hashed');
    });

    it('rejects a nonexistent user with a generic 401', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with the same generic 401 message', async () => {
      const user = makeUser();
      users.findByEmailWithPassword.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getMe', () => {
    it('returns the public profile of the current user', async () => {
      users.findById.mockResolvedValue(makeUser());
      const user = await service.getMe('user-1');
      expect(user.id).toBe('user-1');
      expect(JSON.stringify(user)).not.toContain('passwordHash');
    });

    it('rejects an unknown user id', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.getMe('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
