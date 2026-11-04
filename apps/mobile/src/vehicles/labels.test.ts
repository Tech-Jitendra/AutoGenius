import {
  odometerLabel,
  purchaseDateLabel,
  titleCase,
  vehicleName,
  vehicleSubtitle,
} from './labels';
import type { VehicleDto } from './types';

const base: VehicleDto = {
  id: 'v1',
  userId: 'u1',
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: null,
  registrationNumber: null,
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'CVT',
  purchaseDate: null,
  currentOdometer: null,
  isDefault: false,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

describe('vehicle labels', () => {
  it('omits a missing variant from the name', () => {
    expect(vehicleName(base)).toBe('Maruti Suzuki Baleno');
    expect(vehicleName({ ...base, variant: 'ZXi CVT' })).toBe('Maruti Suzuki Baleno ZXi CVT');
  });

  it('explains which optional fields are missing', () => {
    expect(vehicleSubtitle(base)).toBe('No plate saved · 2019 · Petrol · Cvt');
    expect(vehicleSubtitle({ ...base, registrationNumber: 'MH 12 AB 1234' })).toBe(
      'MH 12 AB 1234 · 2019 · Petrol · Cvt',
    );
  });

  it('labels an absent odometer instead of showing zero', () => {
    expect(odometerLabel(base)).toBe('Odometer not recorded');
    expect(odometerLabel({ ...base, currentOdometer: 42000 })).toBe('42,000 km on record');
  });

  it('labels an absent purchase date', () => {
    expect(purchaseDateLabel(base)).toBe('Purchase date not recorded');
    expect(purchaseDateLabel({ ...base, purchaseDate: '2019-06-15' })).toBe('2019-06-15');
  });

  it('title cases enum values for display', () => {
    expect(titleCase('ELECTRIC')).toBe('Electric');
    expect(titleCase('AMT')).toBe('Amt');
  });
});
