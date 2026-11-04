import { createVehicleSchema, type CreateVehicleInput } from '@autogenius/validation';
import { toUpdateInput, vehicleToFormValues } from './vehicle-form';
import { validateForm } from '../auth/form-validation';
import type { VehicleDto } from './types';

const vehicle: VehicleDto = {
  id: 'v1',
  userId: 'u1',
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: 'ZXi CVT',
  registrationNumber: 'MH 12 AB 1234',
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'CVT',
  purchaseDate: '2019-06-15',
  currentOdometer: 42000,
  isDefault: true,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

describe('vehicle form mapping', () => {
  it('renders nulls as empty inputs', () => {
    const values = vehicleToFormValues({
      ...vehicle,
      variant: null,
      registrationNumber: null,
      purchaseDate: null,
      currentOdometer: null,
    });

    expect(values).toEqual({
      make: 'Maruti Suzuki',
      model: 'Baleno',
      variant: '',
      registrationNumber: '',
      manufacturingYear: '2019',
      fuelType: 'PETROL',
      transmission: 'CVT',
      purchaseDate: '',
      currentOdometer: '',
    });
  });

  it('round-trips a saved vehicle back into the same payload', () => {
    const result = validateForm(createVehicleSchema, vehicleToFormValues(vehicle));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(toUpdateInput(result.values)).toEqual({
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      registrationNumber: vehicle.registrationNumber,
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      purchaseDate: vehicle.purchaseDate,
      currentOdometer: vehicle.currentOdometer,
    });
  });

  it('sends null for blank optional fields so a patch clears them', () => {
    const input: CreateVehicleInput = {
      make: 'Hyundai',
      model: 'i20',
      manufacturingYear: 2021,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
    };

    expect(toUpdateInput(input)).toEqual({
      ...input,
      variant: null,
      registrationNumber: null,
      purchaseDate: null,
      currentOdometer: null,
    });
  });

  it('keeps a zero odometer as a value rather than clearing it', () => {
    const input: CreateVehicleInput = {
      make: 'Hyundai',
      model: 'i20',
      manufacturingYear: 2021,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
      currentOdometer: 0,
    };

    expect(toUpdateInput(input).currentOdometer).toBe(0);
  });
});
