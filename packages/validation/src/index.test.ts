import {
  loginSchema,
  logoutSchema,
  normalizeEmail,
  parseEnv,
  refreshSchema,
  registerSchema,
} from './index';

const validEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/autogenius',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('parses a valid environment with defaults applied', () => {
    const env = parseEnv(validEnv);
    expect(env.API_PORT).toBe(3001);
    expect(env.REDIS_HOST).toBe('localhost');
    expect(env.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe('30d');
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(5);
    expect(env.RATE_LIMIT_REFRESH_MAX).toBe(10);
  });

  it('rejects a JWT secret that is too short', () => {
    expect(() =>
      parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow();
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('treats empty optional Qwen settings as unset', () => {
    const env = parseEnv({ ...validEnv, QWEN_API_KEY: '', QWEN_BASE_URL: '' });
    expect(env.QWEN_API_KEY).toBeUndefined();
    expect(env.QWEN_BASE_URL).toBeUndefined();
  });

  it('keeps a valid Qwen base URL', () => {
    const env = parseEnv({
      ...validEnv,
      QWEN_BASE_URL: 'https://dashscope.example.com/v1',
    });
    expect(env.QWEN_BASE_URL).toBe('https://dashscope.example.com/v1');
  });

  it('rejects a malformed non-empty Qwen base URL', () => {
    expect(() => parseEnv({ ...validEnv, QWEN_BASE_URL: 'nope' })).toThrow();
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration with phone', () => {
    const parsed = registerSchema.parse({
      name: 'Jitendra',
      email: 'a@b.com',
      phone: '+919876543210',
      password: 'password123',
    });
    expect(parsed.phone).toBe('+919876543210');
  });

  it('accepts a valid registration without phone', () => {
    const parsed = registerSchema.parse({
      name: 'Jitendra',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(parsed.phone).toBeUndefined();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() =>
      registerSchema.parse({ name: 'A', email: 'a@b.com', password: 'short' }),
    ).toThrow();
  });

  it('rejects a password longer than 72 characters', () => {
    expect(() =>
      registerSchema.parse({
        name: 'A',
        email: 'a@b.com',
        password: 'x'.repeat(73),
      }),
    ).toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() =>
      registerSchema.parse({
        name: 'A',
        email: 'not-an-email',
        password: 'password123',
      }),
    ).toThrow();
  });

  it('trims whitespace-padded emails', () => {
    const parsed = registerSchema.parse({
      name: 'A',
      email: '  User@Example.COM ',
      password: 'password123',
    });
    expect(parsed.email).toBe('User@Example.COM');
  });

  it('rejects an invalid phone', () => {
    expect(() =>
      registerSchema.parse({
        name: 'A',
        email: 'a@b.com',
        phone: 'abc',
        password: 'password123',
      }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(() =>
      loginSchema.parse({ email: 'a@b.com', password: 'whatever' }),
    ).not.toThrow();
  });

  it('rejects a missing password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com' })).toThrow();
  });

  it('trims whitespace-padded emails', () => {
    const parsed = loginSchema.parse({
      email: '  User@Example.COM ',
      password: 'whatever',
    });
    expect(parsed.email).toBe('User@Example.COM');
  });
});

describe('refresh/logout schemas', () => {
  it('accepts a non-empty refresh token', () => {
    expect(() => refreshSchema.parse({ refreshToken: 'tok' })).not.toThrow();
    expect(() => logoutSchema.parse({ refreshToken: 'tok' })).not.toThrow();
  });

  it('rejects an empty refresh token', () => {
    expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
    expect(() => logoutSchema.parse({ refreshToken: '' })).toThrow();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});
