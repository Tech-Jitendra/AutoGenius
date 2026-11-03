import { createHash } from 'crypto';
import { hashRefreshToken } from './token-hash';

describe('hashRefreshToken', () => {
  it('returns the sha256 hex digest of the token', () => {
    const token = 'some-random-refresh-token';
    expect(hashRefreshToken(token)).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
  });

  it('produces 64 hex characters', () => {
    expect(hashRefreshToken('x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs between tokens', () => {
    expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
  });
});
