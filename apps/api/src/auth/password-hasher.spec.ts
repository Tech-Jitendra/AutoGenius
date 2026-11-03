import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes a password so the plaintext is not recoverable from the hash', async () => {
    const hash = await hasher.hash('password123');
    expect(hash).not.toContain('password123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('produces different hashes for the same password', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('password123'),
      hasher.hash('password123'),
    ]);
    expect(first).not.toBe(second);
  });

  it('compares a correct password successfully', async () => {
    const hash = await hasher.hash('password123');
    await expect(hasher.compare('password123', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('password123');
    await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false);
  });
});
