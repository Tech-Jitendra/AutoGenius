import { parseEnv } from './index';

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
  });

  it('rejects a JWT secret that is too short', () => {
    expect(() =>
      parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow();
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
