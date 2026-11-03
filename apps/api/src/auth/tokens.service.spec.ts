import { durationToMs } from './tokens.service';

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
