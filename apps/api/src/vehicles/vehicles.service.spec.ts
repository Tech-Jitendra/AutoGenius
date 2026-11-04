import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { CreateVehicleInput, UpdateVehicleInput } from '@autogenius/validation';
import { VehicleEntity } from './vehicle.entity';
import { toVehicle, VehiclesService } from './vehicles.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';

function pgFailure(code: string, constraint?: string): QueryFailedError {
  return new QueryFailedError(
    'INSERT INTO "vehicles" ...',
    [],
    Object.assign(
      new Error(
        constraint
          ? `duplicate key value violates unique constraint "${constraint}"`
          : `database failure for ${code}`,
      ),
      { code, constraint },
    ),
  );
}

function makeVehicle(overrides: Partial<VehicleEntity> = {}): VehicleEntity {
  return {
    id: VEHICLE_ID,
    userId: USER_ID,
    make: 'Maruti Suzuki',
    model: 'Baleno',
    variant: 'ZXi',
    registrationNumber: 'MH 12 AB 1234',
    manufacturingYear: 2019,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    purchaseDate: '2019-06-15',
    currentOdometer: 42_000,
    isDefault: true,
    createdAt: new Date('2026-10-05T00:00:00Z'),
    updatedAt: new Date('2026-10-05T00:00:00Z'),
    ...overrides,
  } as VehicleEntity;
}

const minimalInput = {
  make: 'Tata',
  model: 'Nexon',
  manufacturingYear: 2022,
  fuelType: 'ELECTRIC',
  transmission: 'AUTOMATIC',
} satisfies CreateVehicleInput;

interface Fakes {
  service: VehiclesService;
  vehicles: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  lock: jest.Mock;
  history: jest.Mock;
  transaction: jest.Mock;
}

function makeFakes(): Fakes {
  const vehicles = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((input: Record<string, unknown>) => input),
    save: jest.fn(async (entity: Record<string, unknown>) => entity),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const lock = jest.fn().mockResolvedValue([{ id: USER_ID }]);
  const history = jest
    .fn()
    .mockResolvedValue([{ serviceRecords: '0', reminders: '0' }]);
  // The transaction manager answers two kinds of raw SQL: the user row lock, and
  // the service-history count that guards deletion.
  const query = jest.fn((sql: string, params: unknown[]) =>
    sql.includes('FOR UPDATE') ? lock(sql, params) : history(sql, params),
  );
  const manager = { query, getRepository: () => vehicles };
  const transaction = jest.fn(async (work: (m: unknown) => Promise<unknown>) =>
    work(manager),
  );
  const service = new VehiclesService(
    vehicles as unknown as never,
    { transaction } as unknown as never,
  );
  return { service, vehicles, lock, history, transaction };
}

describe('VehiclesService', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = makeFakes();
  });

  describe('list', () => {
    it('reads only the caller\'s vehicles and orders the default first', async () => {
      fakes.vehicles.find.mockResolvedValue([
        makeVehicle(),
        makeVehicle({ id: OTHER_USER, isDefault: false }),
      ]);

      const result = await fakes.service.list(USER_ID);

      expect(fakes.vehicles.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns an empty list for a user without vehicles', async () => {
      expect(await fakes.service.list(USER_ID)).toEqual([]);
    });
  });

  describe('findOwned', () => {
    it('returns the vehicle when it belongs to the caller', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());
      const vehicle = await fakes.service.findOwned(USER_ID, VEHICLE_ID);
      expect(vehicle.id).toBe(VEHICLE_ID);
      // Ownership is enforced by the query itself, not by a post-check.
      expect(fakes.vehicles.findOne).toHaveBeenCalledWith({
        where: { id: VEHICLE_ID, userId: USER_ID },
      });
    });

    it('treats another user\'s vehicle as not found', async () => {
      fakes.vehicles.findOne.mockResolvedValue(null);
      await expect(fakes.service.findOwned(OTHER_USER, VEHICLE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('makes the first vehicle the default', async () => {
      fakes.vehicles.count.mockResolvedValue(0);

      const vehicle = await fakes.service.create(USER_ID, minimalInput);

      expect(fakes.vehicles.count).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(vehicle.isDefault).toBe(true);
      expect(vehicle.userId).toBe(USER_ID);
    });

    it('never marks a later vehicle as default', async () => {
      fakes.vehicles.count.mockResolvedValue(2);
      const vehicle = await fakes.service.create(USER_ID, minimalInput);
      expect(vehicle.isDefault).toBe(false);
    });

    it('stores null for optionals the caller left blank', async () => {
      await fakes.service.create(USER_ID, minimalInput);
      expect(fakes.vehicles.save).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: null,
          registrationNumber: null,
          purchaseDate: null,
          currentOdometer: null,
        }),
      );
    });

    it('locks the owning user row before writing', async () => {
      await fakes.service.create(USER_ID, minimalInput);
      expect(fakes.lock).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [USER_ID],
      );
      const lockOrder = fakes.lock.mock.invocationCallOrder[0] ?? 0;
      const saveOrder = fakes.vehicles.save.mock.invocationCallOrder[0] ?? 0;
      expect(lockOrder).toBeLessThan(saveOrder);
    });

    it('maps a duplicate plate for this user to a conflict', async () => {
      fakes.vehicles.save.mockRejectedValueOnce(
        pgFailure('23505', 'vehicles_user_registration_unique'),
      );
      await expect(fakes.service.create(USER_ID, minimalInput)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('maps a duplicate plate reported only in the message to a conflict', async () => {
      // Some servers name the offending index in the message but not in the
      // error's constraint field.
      const messageOnly = Object.assign(
        new QueryFailedError(
          'INSERT INTO "vehicles" ...',
          [],
          new Error(
            'duplicate key value violates unique constraint "vehicles_user_registration_unique"',
          ),
        ),
        { code: '23505' },
      );
      fakes.vehicles.save.mockRejectedValueOnce(messageOnly);
      await expect(fakes.service.create(USER_ID, minimalInput)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows an unrelated database failure without turning it into a user error', async () => {
      const failure = pgFailure('23503');
      fakes.vehicles.save.mockRejectedValue(failure);

      const result = await fakes.service
        .create(USER_ID, minimalInput)
        .catch((error: unknown) => error);

      expect(result).toBe(failure);
      expect(result).not.toBeInstanceOf(HttpException);
    });
  });

  describe('update', () => {
    const id = VEHICLE_ID;

    it('changes only the supplied fields', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());

      const input: UpdateVehicleInput = { currentOdometer: 51_000 };
      const vehicle = await fakes.service.update(USER_ID, id, input);

      expect(vehicle.currentOdometer).toBe(51_000);
      expect(vehicle.make).toBe('Maruti Suzuki');
      expect(vehicle.isDefault).toBe(true);
    });

    it('clears a field when the caller sends an explicit null', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());

      const vehicle = await fakes.service.update(USER_ID, id, { variant: null });

      expect(vehicle.variant).toBeNull();
    });

    it('scopes the lookup by user id, so another vehicle is not found', async () => {
      fakes.vehicles.findOne.mockResolvedValue(null);

      await expect(
        fakes.service.update(OTHER_USER, id, { currentOdometer: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.vehicles.save).not.toHaveBeenCalled();
    });

    it('maps a duplicate plate to a conflict', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());
      fakes.vehicles.save.mockRejectedValueOnce(
        pgFailure('23505', 'vehicles_user_registration_unique'),
      );
      await expect(
        fakes.service.update(USER_ID, id, { registrationNumber: 'MH 13 CD 5678' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('setDefault', () => {
    it('demotes the current default before promoting the new one', async () => {
      fakes.vehicles.findOne.mockResolvedValue(
        makeVehicle({ isDefault: false }),
      );

      const vehicle = await fakes.service.setDefault(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.update).toHaveBeenCalledWith(
        { userId: USER_ID, isDefault: true },
        { isDefault: false },
      );
      expect(vehicle.isDefault).toBe(true);
      const demoteOrder = fakes.vehicles.update.mock.invocationCallOrder[0] ?? 0;
      const promoteOrder = fakes.vehicles.save.mock.invocationCallOrder[0] ?? 0;
      expect(demoteOrder).toBeLessThan(promoteOrder);
    });

    it('is idempotent for the vehicle that is already default', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle({ isDefault: true }));

      const vehicle = await fakes.service.setDefault(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.update).not.toHaveBeenCalled();
      expect(vehicle.isDefault).toBe(true);
    });

    it('refuses to promote another user\'s vehicle', async () => {
      fakes.vehicles.findOne.mockResolvedValue(null);

      await expect(fakes.service.setDefault(OTHER_USER, VEHICLE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fakes.vehicles.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only the caller\'s vehicle', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle({ isDefault: false }));

      await fakes.service.remove(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: VEHICLE_ID, userId: USER_ID }),
      );
    });

    it('promotes a remaining vehicle when the default is deleted', async () => {
      const successor = makeVehicle({ id: OTHER_USER, isDefault: false });
      fakes.vehicles.findOne
        .mockResolvedValueOnce(makeVehicle({ isDefault: true }))
        .mockResolvedValueOnce(successor);

      await fakes.service.remove(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.findOne).toHaveBeenLastCalledWith({
        where: { userId: USER_ID },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      expect(successor.isDefault).toBe(true);
      expect(fakes.vehicles.save).toHaveBeenCalledWith(successor);
    });

    it('leaves no default behind when the last vehicle is deleted', async () => {
      fakes.vehicles.findOne.mockResolvedValueOnce(makeVehicle({ isDefault: true }));

      await fakes.service.remove(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.save).not.toHaveBeenCalled();
    });

    it('does not look for a successor when a non-default vehicle is deleted', async () => {
      fakes.vehicles.findOne.mockResolvedValueOnce(makeVehicle({ isDefault: false }));

      await fakes.service.remove(USER_ID, VEHICLE_ID);

      expect(fakes.vehicles.findOne).toHaveBeenCalledTimes(1);
    });

    it('rejects deleting another user\'s vehicle', async () => {
      fakes.vehicles.findOne.mockResolvedValue(null);

      await expect(fakes.service.remove(OTHER_USER, VEHICLE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fakes.vehicles.remove).not.toHaveBeenCalled();
    });

    it('refuses to delete a vehicle that has a past', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());
      fakes.history.mockResolvedValue([{ serviceRecords: '2', reminders: '1' }]);

      await expect(fakes.service.remove(USER_ID, VEHICLE_ID)).rejects.toThrow(
        'This vehicle still has 2 service records and 1 maintenance reminder. Delete those first if you really want the vehicle gone — service history is never removed as a side effect of deleting a vehicle.',
      );
      expect(fakes.vehicles.remove).not.toHaveBeenCalled();
      expect(fakes.vehicles.update).not.toHaveBeenCalled();
    });

    it('refuses on reminders alone', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());
      fakes.history.mockResolvedValue([{ serviceRecords: '0', reminders: '1' }]);

      await expect(fakes.service.remove(USER_ID, VEHICLE_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(fakes.vehicles.remove).not.toHaveBeenCalled();
    });

    it('counts the history inside the user lock, so it cannot change mid-check', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle());

      await fakes.service.remove(USER_ID, VEHICLE_ID);

      expect(fakes.history).toHaveBeenCalledWith(expect.stringContaining('service_records'), [
        VEHICLE_ID,
      ]);
      const lockOrder = fakes.lock.mock.invocationCallOrder[0] ?? 0;
      const countOrder = fakes.history.mock.invocationCallOrder[0] ?? 0;
      const deleteOrder = fakes.vehicles.remove.mock.invocationCallOrder[0] ?? 0;
      expect(lockOrder).toBeLessThan(countOrder);
      expect(countOrder).toBeLessThan(deleteOrder);
    });

    it('keeps the old behaviour for a vehicle with no history', async () => {
      fakes.vehicles.findOne.mockResolvedValue(makeVehicle({ isDefault: false }));
      await expect(fakes.service.remove(USER_ID, VEHICLE_ID)).resolves.toBeUndefined();
    });
  });

  describe('response shape', () => {
    it('exposes exactly the documented vehicle fields', () => {
      expect(Object.keys(toVehicle(makeVehicle())).sort()).toEqual(
        [
          'id',
          'userId',
          'make',
          'model',
          'variant',
          'registrationNumber',
          'manufacturingYear',
          'fuelType',
          'transmission',
          'purchaseDate',
          'currentOdometer',
          'isDefault',
          'createdAt',
          'updatedAt',
        ].sort(),
      );
    });
  });
});
