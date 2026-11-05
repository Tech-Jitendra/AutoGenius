import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import {
  BLANK_RECORD,
  filledParts,
  previewTotalCost,
  recordToFormValues,
  ServiceRecordForm,
  toUpdateRecordInput,
  todayIsoDate,
  type ServiceRecordFormValues,
} from './service-record-form';
import type { ServiceRecordDto } from './types';

const record: ServiceRecordDto = {
  id: 'r1',
  vehicleId: 'v1',
  serviceDate: '2026-05-12',
  odometerKm: 42_000,
  workshopName: 'City Auto Care',
  serviceType: 'OIL_CHANGE',
  description: 'Engine oil and filter',
  partsReplaced: [
    { name: 'Oil filter', quantity: 1, cost: 350 },
    { name: 'Washer', quantity: null, cost: null },
  ],
  labourCost: 800,
  partsCost: 1250.5,
  otherCost: 149.5,
  totalCost: 2200,
  notes: null,
  createdAt: '2026-05-12T09:00:00.000Z',
  updatedAt: '2026-05-12T09:00:00.000Z',
};

const values = (overrides: Partial<ServiceRecordFormValues> = {}): ServiceRecordFormValues => ({
  ...BLANK_RECORD,
  serviceDate: '2026-05-12',
  serviceType: 'GENERAL_SERVICE',
  ...overrides,
});

function textOf(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAllByType(Text)
    .map((node) =>
      [node.props.children]
        .flat(Infinity as 1)
        .filter((child: unknown) => typeof child === 'string')
        .join(''),
    )
    .join('\n');
}

async function renderForm(props: Parameters<typeof ServiceRecordForm>[0]) {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ServiceRecordForm {...props} />);
  });
  return tree;
}

async function typeInto(
  tree: ReturnType<typeof create>,
  accessibilityLabel: string,
  text: string,
) {
  const input = tree.root.findAllByProps({ accessibilityLabel })[0];
  if (!input) throw new Error(`No input labelled ${accessibilityLabel}`);
  await act(async () => {
    input.props.onChangeText(text);
  });
}

async function press(tree: ReturnType<typeof create>, accessibilityLabel: string) {
  const button = tree.root.findAllByProps({ accessibilityLabel })[0];
  if (!button) throw new Error(`No button labelled ${accessibilityLabel}`);
  await act(async () => {
    button.props.onPress();
  });
}

describe('service record form mapping', () => {
  it('shows stored nulls as empty inputs', () => {
    expect(recordToFormValues({ ...record, odometerKm: null, notes: null })).toEqual({
      serviceDate: '2026-05-12',
      odometerKm: '',
      workshopName: 'City Auto Care',
      serviceType: 'OIL_CHANGE',
      description: 'Engine oil and filter',
      parts: [
        { name: 'Oil filter', quantity: '1', cost: '350' },
        { name: 'Washer', quantity: '', cost: '' },
      ],
      labourCost: '800',
      partsCost: '1250.5',
      otherCost: '149.5',
      notes: '',
    });
  });

  it('round-trips a saved visit back into the same payload', () => {
    const mapped = recordToFormValues(record);
    expect(filledParts(mapped)).toEqual([
      { name: 'Oil filter', quantity: '1', cost: '350' },
      { name: 'Washer', quantity: '', cost: '' },
    ]);
    expect(previewTotalCost(mapped)).toBe('₹2,200');
  });

  it('drops part rows the user left unnamed', () => {
    expect(
      filledParts(
        values({
          parts: [
            { name: '  ', quantity: '2', cost: '' },
            { name: 'Brake pads', quantity: '', cost: '' },
          ],
        }),
      ),
    ).toEqual([{ name: 'Brake pads', quantity: '', cost: '' }]);
  });

  it('clears optional fields with null but keeps costs at zero', () => {
    // Costs are NOT NULL columns with a default, so a blank cost must go out as
    // 0; text and the odometer are nullable, so they clear with null.
    expect(toUpdateRecordInput({ serviceDate: '2026-05-12', serviceType: 'OTHER' })).toEqual({
      serviceDate: '2026-05-12',
      serviceType: 'OTHER',
      odometerKm: null,
      workshopName: null,
      description: null,
      notes: null,
      partsReplaced: [],
      labourCost: 0,
      partsCost: 0,
      otherCost: 0,
    });
  });

  it('keeps a zero cost as a value rather than clearing it', () => {
    const input = toUpdateRecordInput({
      serviceDate: '2026-05-12',
      serviceType: 'BATTERY',
      labourCost: 0,
    });
    expect(input.labourCost).toBe(0);
  });

  it('pre-fills the date the server treats as today', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('service record form validation', () => {
  it('adds up the three costs as the total, without letting float error in', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      submitLabel: 'Save visit',
      pending: false,
      onSubmit,
    });

    await typeInto(tree, 'Labour cost', '0.1');
    await typeInto(tree, 'Parts cost', '0.2');
    await typeInto(tree, 'Other cost', '0');

    expect(textOf(tree)).toContain('₹0.30');
  });

  it('refuses a future service date', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: values({ serviceDate: '2999-01-01' }),
      submitLabel: 'Save visit',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save visit');

    expect(textOf(tree)).toContain('Service date cannot be in the future');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a negative cost', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: values({ labourCost: '-100' }),
      submitLabel: 'Save visit',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save visit');

    expect(textOf(tree)).toContain('Cost cannot be negative');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a service type', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: { ...values(), serviceType: '' },
      submitLabel: 'Save visit',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save visit');

    expect(textOf(tree)).toContain('Invalid enum value');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the visit with the parts list the user added', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: values(),
      submitLabel: 'Save visit',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Add part');
    await typeInto(tree, 'Part 1 name', 'Brake pads');
    await typeInto(tree, 'Part 1 quantity', '4');
    await typeInto(tree, 'Part 1 cost', '2500');
    await typeInto(tree, 'Workshop name', 'City Auto Care');
    await typeInto(tree, 'Service odometer', '42000');
    await typeInto(tree, 'Labour cost', '800');
    await press(tree, 'Save visit');

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceDate: '2026-05-12',
        serviceType: 'GENERAL_SERVICE',
        workshopName: 'City Auto Care',
        odometerKm: 42_000,
        labourCost: 800,
        partsReplaced: [{ name: 'Brake pads', quantity: 4, cost: 2500 }],
      }),
    );
  });

  it('shows the server rejection instead of pretending the visit saved', async () => {
    const tree = await renderForm({
      submitLabel: 'Save visit',
      pending: false,
      serverError: 'Service record id must be a UUID',
      onSubmit: jest.fn(),
    });

    expect(textOf(tree)).toContain('Service record id must be a UUID');
  });
});
