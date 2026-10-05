import { formatINR } from './format';

describe('formatINR', () => {
  it('formats amounts in Indian numbering format', () => {
    expect(formatINR(8450)).toBe('₹8,450');
  });

  it('formats lakhs with the Indian digit grouping', () => {
    expect(formatINR(150000)).toBe('₹1,50,000');
  });
});
