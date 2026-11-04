import type { VehicleDto } from './types';

export function vehicleName(vehicle: VehicleDto): string {
  return [vehicle.make, vehicle.model, vehicle.variant]
    .filter(Boolean)
    .join(' ');
}

export function vehicleSubtitle(vehicle: VehicleDto): string {
  return [
    vehicle.registrationNumber ?? 'No plate saved',
    String(vehicle.manufacturingYear),
    titleCase(vehicle.fuelType),
    titleCase(vehicle.transmission),
  ].join(' · ');
}

export function odometerLabel(vehicle: VehicleDto): string {
  if (vehicle.currentOdometer === null) {
    return 'Odometer not recorded';
  }
  return `${vehicle.currentOdometer.toLocaleString('en-IN')} km on record`;
}

export function purchaseDateLabel(vehicle: VehicleDto): string {
  return vehicle.purchaseDate ?? 'Purchase date not recorded';
}

export function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
