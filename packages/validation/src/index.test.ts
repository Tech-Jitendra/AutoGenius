import {
  completeMaintenanceReminderSchema,
  createMaintenanceReminderSchema,
  createServiceRecordSchema,
  createVehicleSchema,
  DEFAULT_PAGE_SIZE,
  loginSchema,
  logoutSchema,
  maintenanceReminderIdSchema,
  maintenanceReminderQuerySchema,
  MAX_COST,
  MAX_INTERVAL_MONTHS,
  MAX_ODOMETER_KM,
  MAX_PAGE_SIZE,
  MAX_PARTS_PER_RECORD,
  MIN_MANUFACTURING_YEAR,
  normalizeEmail,
  normalizeRegistrationNumber,
  parseEnv,
  refreshSchema,
  registerSchema,
  REMINDER_DUE_CONDITION_MESSAGE,
  serviceRecordIdSchema,
  serviceRecordQuerySchema,
  updateMaintenanceReminderSchema,
  updateServiceRecordSchema,
  updateVehicleSchema,
  vehicleIdSchema,
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

  it('normalises the separators people type into a phone number', () => {
    const cases: [string, string][] = [
      ['+91 98765 43210', '+919876543210'],
      ['98765-43210', '9876543210'],
      ['(020) 7654 3210', '02076543210'],
      ['  +919876543210  ', '+919876543210'],
    ];
    for (const [input, expected] of cases) {
      const parsed = registerSchema.parse({
        name: 'A',
        email: 'a@b.com',
        phone: input,
        password: 'password123',
      });
      expect(parsed.phone).toBe(expected);
    }
  });

  it('treats an empty phone as not provided', () => {
    const parsed = registerSchema.parse({
      name: 'A',
      email: 'a@b.com',
      phone: '',
      password: 'password123',
    });
    expect(parsed.phone).toBeUndefined();
  });

  it('treats a whitespace-only phone as not provided', () => {
    const parsed = registerSchema.parse({
      name: 'A',
      email: 'a@b.com',
      phone: '   ',
      password: 'password123',
    });
    expect(parsed.phone).toBeUndefined();
  });

  it('explains what a valid phone looks like', () => {
    const result = registerSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      phone: '12345',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    const issue = result.success
      ? undefined
      : result.error.issues.find((entry) => entry.path[0] === 'phone');
    expect(issue?.message).toBe(
      'Phone must be 8 to 15 digits, optionally starting with +',
    );
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

const currentYear = new Date().getFullYear();

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe('normalizeRegistrationNumber', () => {
  it('uppercases and collapses internal whitespace', () => {
    expect(normalizeRegistrationNumber('  mh   12 ab   1234 ')).toBe('MH 12 AB 1234');
  });
});

describe('createVehicleSchema', () => {
  const valid = {
    make: 'Maruti Suzuki',
    model: 'Baleno',
    manufacturingYear: 2019,
    fuelType: 'PETROL',
    transmission: 'MANUAL',
  };

  it('accepts the minimal payload and leaves optionals undefined', () => {
    const parsed = createVehicleSchema.parse(valid);
    expect(parsed).toEqual({ ...valid, variant: undefined, registrationNumber: undefined, purchaseDate: undefined, currentOdometer: undefined });
  });

  it('accepts a fully populated payload', () => {
    const parsed = createVehicleSchema.parse({
      ...valid,
      variant: 'ZXi CVT',
      registrationNumber: 'MH 12 AB 1234',
      purchaseDate: '2019-06-15',
      currentOdometer: 42_000,
    });
    expect(parsed.currentOdometer).toBe(42_000);
    expect(parsed.purchaseDate).toBe('2019-06-15');
  });

  it('normalizes the registration number before validating it', () => {
    const parsed = createVehicleSchema.parse({
      ...valid,
      registrationNumber: '  mh   12 ab  1234 ',
    });
    expect(parsed.registrationNumber).toBe('MH 12 AB 1234');
  });

  it('treats empty optional strings as unset instead of failing validation', () => {
    const parsed = createVehicleSchema.parse({
      ...valid,
      variant: '',
      registrationNumber: '',
      purchaseDate: '',
      currentOdometer: '',
    });
    expect(parsed.variant).toBeUndefined();
    expect(parsed.registrationNumber).toBeUndefined();
    expect(parsed.purchaseDate).toBeUndefined();
    expect(parsed.currentOdometer).toBeUndefined();
  });

  it('keeps an explicit null so callers can clear a field', () => {
    const parsed = createVehicleSchema.parse({
      ...valid,
      variant: null,
      registrationNumber: null,
      purchaseDate: null,
      currentOdometer: null,
    });
    expect(parsed.variant).toBeNull();
    expect(parsed.registrationNumber).toBeNull();
    expect(parsed.purchaseDate).toBeNull();
    expect(parsed.currentOdometer).toBeNull();
  });

  it('coerces numeric strings coming from mobile inputs', () => {
    const parsed = createVehicleSchema.parse({
      ...valid,
      manufacturingYear: '2021',
      currentOdometer: '0',
    });
    expect(parsed.manufacturingYear).toBe(2021);
    expect(parsed.currentOdometer).toBe(0);
  });

  it.each([
    ['make', { ...valid, make: '' }],
    ['model', { ...valid, model: '' }],
    ['make over 50 chars', { ...valid, make: 'x'.repeat(51) }],
    ['variant over 50 chars', { ...valid, variant: 'x'.repeat(51) }],
    ['unknown fuelType', { ...valid, fuelType: 'PETTROL' }],
    ['unknown transmission', { ...valid, transmission: 'DCT' }],
    ['registration with symbols', { ...valid, registrationNumber: 'MH-12-AB@1234' }],
    ['short registration', { ...valid, registrationNumber: 'MH12' }],
    ['impossible purchase date', { ...valid, purchaseDate: '2019-02-30' }],
    ['malformed purchase date', { ...valid, purchaseDate: '15/06/2019' }],
    ['future purchase date', { ...valid, purchaseDate: isoDate(1) }],
    ['negative odometer', { ...valid, currentOdometer: -1 }],
    ['fractional odometer', { ...valid, currentOdometer: 12.5 }],
    ['odometer above the cap', { ...valid, currentOdometer: MAX_ODOMETER_KM + 1 }],
  ])('rejects %s', (_label, input) => {
    expect(createVehicleSchema.safeParse(input).success).toBe(false);
  });

  it('accepts today as a purchase date but rejects next year', () => {
    expect(createVehicleSchema.safeParse({ ...valid, purchaseDate: isoDate(0) }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...valid, purchaseDate: isoDate(30) }).success).toBe(false);
  });

  it('bounds the manufacturing year', () => {
    expect(createVehicleSchema.safeParse({ ...valid, manufacturingYear: MIN_MANUFACTURING_YEAR }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...valid, manufacturingYear: MIN_MANUFACTURING_YEAR - 1 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valid, manufacturingYear: currentYear + 1 }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...valid, manufacturingYear: currentYear + 2 }).success).toBe(false);
  });

  it('reports the field that failed', () => {
    const result = createVehicleSchema.safeParse({ ...valid, fuelType: 'PETTROL' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['fuelType']);
    }
  });
});

describe('updateVehicleSchema', () => {
  it('accepts a single changed field', () => {
    const parsed = updateVehicleSchema.parse({ currentOdometer: 51_000 });
    expect(parsed.currentOdometer).toBe(51_000);
  });

  it('rejects an empty body', () => {
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a body whose only field is blank', () => {
    expect(updateVehicleSchema.safeParse({ variant: '' }).success).toBe(false);
  });

  it('accepts an explicit null as a request to clear a field', () => {
    const parsed = updateVehicleSchema.parse({ registrationNumber: null });
    expect(parsed.registrationNumber).toBeNull();
  });

  it('still validates the values it does receive', () => {
    expect(updateVehicleSchema.safeParse({ transmission: 'DCT' }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ manufacturingYear: 1899 }).success).toBe(false);
  });
});

describe('vehicleIdSchema', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(vehicleIdSchema.parse('3f2b6c1a-9d4e-4a7b-8c1f-0a2b5d6e7f80')).toBe(
      '3f2b6c1a-9d4e-4a7b-8c1f-0a2b5d6e7f80',
    );
    expect(vehicleIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('createServiceRecordSchema', () => {
  const valid = { serviceDate: '2026-03-14', serviceType: 'GENERAL_SERVICE' };

  it('accepts the minimal payload', () => {
    const parsed = createServiceRecordSchema.parse(valid);
    expect(parsed).toEqual({ ...valid, workshopName: undefined });
  });

  it('keeps parts as structured lines and defaults blanks to undefined', () => {
    const parsed = createServiceRecordSchema.parse({
      ...valid,
      workshopName: 'City Auto',
      description: '',
      partsReplaced: [
        { name: 'Oil filter', quantity: '1', cost: '450.5' },
        { name: 'Engine oil 5W-30', quantity: '', cost: '' },
      ],
      labourCost: '1200',
    });
    expect(parsed.description).toBeUndefined();
    expect(parsed.partsReplaced).toEqual([
      { name: 'Oil filter', quantity: 1, cost: 450.5 },
      { name: 'Engine oil 5W-30', quantity: undefined, cost: undefined },
    ]);
    expect(parsed.labourCost).toBe(1200);
  });

  it('rounds money to the two decimals the column can store', () => {
    const parsed = createServiceRecordSchema.parse({ ...valid, partsCost: 1234.567 });
    expect(parsed.partsCost).toBe(1234.57);
  });

  it.each([
    ['a future service date', { ...valid, serviceDate: isoDate(1) }],
    ['an impossible service date', { ...valid, serviceDate: '2026-02-30' }],
    ['a malformed service date', { ...valid, serviceDate: '14/03/2026' }],
    ['a missing service date', { serviceType: 'GENERAL_SERVICE' }],
    ['an unknown service type', { ...valid, serviceType: 'WRAP' }],
    ['a negative labour cost', { ...valid, labourCost: -1 }],
    ['a negative parts cost', { ...valid, partsCost: '-5' }],
    ['a cost above the cap', { ...valid, otherCost: MAX_COST + 1 }],
    ['a negative odometer', { ...valid, odometerKm: -10 }],
    ['an odometer above the cap', { ...valid, odometerKm: MAX_ODOMETER_KM + 1 }],
    ['more parts than allowed', {
      ...valid,
      partsReplaced: Array.from({ length: MAX_PARTS_PER_RECORD + 1 }, (_unused, index) => ({
        name: `part ${index}`,
      })),
    }],
    ['a part without a name', { ...valid, partsReplaced: [{ quantity: 1 }] }],
  ])('rejects %s', (_label, input) => {
    expect(createServiceRecordSchema.safeParse(input).success).toBe(false);
  });

  it('accepts today as a service date', () => {
    expect(createServiceRecordSchema.safeParse({ ...valid, serviceDate: isoDate(0) }).success).toBe(
      true,
    );
  });
});

describe('updateServiceRecordSchema', () => {
  it('accepts a single changed field', () => {
    expect(updateServiceRecordSchema.safeParse({ notes: 'Rechecked after the trip' }).success).toBe(
      true,
    );
  });

  it('rejects an empty body and a body of blanks', () => {
    expect(updateServiceRecordSchema.safeParse({}).success).toBe(false);
    expect(updateServiceRecordSchema.safeParse({ workshopName: '' }).success).toBe(false);
  });

  it('accepts an explicit null to clear a field', () => {
    const parsed = updateServiceRecordSchema.parse({ odometerKm: null });
    expect(parsed.odometerKm).toBeNull();
  });

  it('still validates the values it does receive', () => {
    expect(updateServiceRecordSchema.safeParse({ serviceType: 'WRAP' }).success).toBe(false);
  });
});

describe('serviceRecordQuerySchema', () => {
  it('applies pagination defaults', () => {
    expect(serviceRecordQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      from: undefined,
      to: undefined,
      serviceType: undefined,
    });
  });

  it('coerces query strings and keeps filters', () => {
    const parsed = serviceRecordQuerySchema.parse({
      page: '3',
      pageSize: '50',
      from: '2026-01-01',
      to: '2026-03-31',
      serviceType: 'OIL_CHANGE',
    });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.serviceType).toBe('OIL_CHANGE');
  });

  it.each([
    ['page 0', { page: '0' }],
    ['a non-numeric page', { page: 'abc' }],
    ['pageSize above the cap', { pageSize: MAX_PAGE_SIZE + 1 }],
    ['an impossible from date', { from: '2026-02-30' }],
    ['from after to', { from: '2026-03-31', to: '2026-01-01' }],
    ['an unknown service type', { serviceType: 'WRAP' }],
  ])('rejects %s', (_label, input) => {
    expect(serviceRecordQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe('createMaintenanceReminderSchema', () => {
  it('accepts a date-only due condition', () => {
    const parsed = createMaintenanceReminderSchema.parse({
      title: 'Oil change',
      dueDate: '2026-12-01',
    });
    expect(parsed.intervalMonths).toBeUndefined();
  });

  it('accepts an odometer-only due condition', () => {
    expect(
      createMaintenanceReminderSchema.safeParse({ title: 'Tyre rotation', dueOdometerKm: 55_000 })
        .success,
    ).toBe(true);
  });

  it('rejects a reminder with no due condition at all', () => {
    const result = createMaintenanceReminderSchema.safeParse({
      title: 'Oil change',
      intervalMonths: 6,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain(REMINDER_DUE_CONDITION_MESSAGE);
    }
  });

  it.each([
    ['a blank title', { title: '', dueDate: '2026-12-01' }],
    ['a title above 120 chars', { title: 'x'.repeat(121), dueDate: '2026-12-01' }],
    ['a malformed due date', { title: 'T', dueDate: '2026-13-01' }],
    ['a zero-month interval', { title: 'T', dueDate: '2026-12-01', intervalMonths: 0 }],
    ['a fractional interval', { title: 'T', dueDate: '2026-12-01', intervalMonths: 1.5 }],
    ['an interval above the cap', {
      title: 'T',
      dueDate: '2026-12-01',
      intervalMonths: MAX_INTERVAL_MONTHS + 1,
    }],
    ['a zero-kilometre interval', { title: 'T', dueDate: '2026-12-01', intervalKm: 0 }],
    ['a negative due odometer', { title: 'T', dueOdometerKm: -1 }],
  ])('rejects %s', (_label, input) => {
    expect(createMaintenanceReminderSchema.safeParse(input).success).toBe(false);
  });

  it('treats blank optionals as unset', () => {
    const parsed = createMaintenanceReminderSchema.parse({
      title: 'Brake fluid',
      dueDate: '2026-12-01',
      description: '',
      intervalMonths: '',
      intervalKm: '',
      dueOdometerKm: '',
    });
    expect(parsed.description).toBeUndefined();
    expect(parsed.intervalMonths).toBeUndefined();
    expect(parsed.intervalKm).toBeUndefined();
    expect(parsed.dueOdometerKm).toBeUndefined();
  });
});

describe('updateMaintenanceReminderSchema', () => {
  it('accepts a partial change and rejects an empty body', () => {
    expect(updateMaintenanceReminderSchema.safeParse({ dueOdometerKm: 60_000 }).success).toBe(true);
    expect(updateMaintenanceReminderSchema.safeParse({}).success).toBe(false);
  });

  it('leaves the due condition to the service because only a subset is sent', () => {
    expect(updateMaintenanceReminderSchema.safeParse({ dueDate: null }).success).toBe(true);
  });
});

describe('completeMaintenanceReminderSchema', () => {
  it('requires both a date and an odometer reading', () => {
    expect(
      completeMaintenanceReminderSchema.safeParse({
        completionDate: '2026-11-04',
        completionOdometerKm: 48_210,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a missing odometer', { completionDate: '2026-11-04' }],
    ['a blank odometer', { completionDate: '2026-11-04', completionOdometerKm: '' }],
    ['a future date', { completionDate: isoDate(2), completionOdometerKm: 10 }],
    ['a negative reading', { completionDate: '2026-11-04', completionOdometerKm: -5 }],
  ])('rejects %s', (_label, input) => {
    expect(completeMaintenanceReminderSchema.safeParse(input).success).toBe(false);
  });
});

describe('maintenanceReminderQuerySchema', () => {
  it('defaults to the first page and no filters', () => {
    expect(maintenanceReminderQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: undefined,
      due: undefined,
    });
  });

  it('accepts either case because browsers and devices differ', () => {
    expect(maintenanceReminderQuerySchema.parse({ status: 'active' }).status).toBe('ACTIVE');
    expect(maintenanceReminderQuerySchema.parse({ due: 'OVERDUE' }).due).toBe('OVERDUE');
  });

  it('rejects unknown filter values', () => {
    expect(maintenanceReminderQuerySchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
    expect(maintenanceReminderQuerySchema.safeParse({ due: 'LATER' }).success).toBe(false);
  });
});

describe('record and reminder id schemas', () => {
  it('only accept UUIDs', () => {
    const uuid = '3f2b6c1a-9d4e-4a7b-8c1f-0a2b5d6e7f80';
    expect(serviceRecordIdSchema.parse(uuid)).toBe(uuid);
    expect(maintenanceReminderIdSchema.parse(uuid)).toBe(uuid);
    expect(serviceRecordIdSchema.safeParse('../etc/passwd').success).toBe(false);
    expect(maintenanceReminderIdSchema.safeParse('1').success).toBe(false);
  });
});
