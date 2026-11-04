import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { createMaintenanceReminderSchema } from '@autogenius/validation';
import {
  BLANK_REMINDER,
  MaintenanceReminderForm,
  reminderToFormValues,
  toUpdateReminderInput,
  type ReminderFormValues,
} from './maintenance-reminder-form';
import type { MaintenanceReminderDto } from './types';

const reminder: MaintenanceReminderDto = {
  id: 'm1',
  vehicleId: 'v1',
  title: 'Rotate tyres',
  description: 'Front to rear',
  dueDate: '2026-12-01',
  dueOdometerKm: 45_000,
  intervalMonths: 6,
  intervalKm: 10_000,
  lastCompletedDate: null,
  lastCompletedOdometerKm: null,
  status: 'ACTIVE',
  alertStatus: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const filled = (overrides: Partial<ReminderFormValues> = {}): ReminderFormValues => ({
  ...BLANK_REMINDER,
  title: 'Oil change',
  dueDate: '2026-12-01',
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

async function renderForm(props: Parameters<typeof MaintenanceReminderForm>[0]) {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<MaintenanceReminderForm {...props} />);
  });
  return tree;
}

async function press(tree: ReturnType<typeof create>, label: string) {
  const button = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!button) throw new Error(`No button labelled ${label}`);
  await act(async () => {
    button.props.onPress();
  });
}

describe('maintenance reminder form mapping', () => {
  it('shows stored nulls as empty inputs', () => {
    expect(reminderToFormValues(reminder)).toEqual({
      title: 'Rotate tyres',
      description: 'Front to rear',
      dueDate: '2026-12-01',
      dueOdometerKm: '45000',
      intervalMonths: '6',
      intervalKm: '10000',
      lastCompletedDate: '',
      lastCompletedOdometerKm: '',
    });
  });

  it('sends every field so a PATCH clears what the user emptied', () => {
    expect(toUpdateReminderInput({ title: 'Align wheels' })).toEqual({
      title: 'Align wheels',
      description: null,
      dueDate: null,
      dueOdometerKm: null,
      intervalMonths: null,
      intervalKm: null,
      lastCompletedDate: null,
      lastCompletedOdometerKm: null,
    });
  });

  it('round-trips a saved reminder into the payload the API expects', () => {
    // Editing nothing must not change anything: the form maps every stored value
    // back into the same fields the API answered with.
    const parsed = createMaintenanceReminderSchema.parse(reminderToFormValues(reminder));

    expect(toUpdateReminderInput(parsed)).toEqual({
      title: 'Rotate tyres',
      description: 'Front to rear',
      dueDate: '2026-12-01',
      dueOdometerKm: 45_000,
      intervalMonths: 6,
      intervalKm: 10_000,
      lastCompletedDate: null,
      lastCompletedOdometerKm: null,
    });
  });
});

describe('maintenance reminder form validation', () => {
  it('insists on a due date or a due odometer reading', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: filled({ dueDate: '' }),
      submitLabel: 'Save reminder',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save reminder');

    expect(textOf(tree)).toContain('A reminder needs a due date or a due odometer reading');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a due date in the future, which is what a reminder is for', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: filled({ dueDate: '2099-01-01' }),
      submitLabel: 'Save reminder',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save reminder');

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Oil change', dueDate: '2099-01-01' }),
    );
  });

  it('requires a title', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: filled({ title: '' }),
      submitLabel: 'Save reminder',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save reminder');

    expect(textOf(tree)).toContain('String must contain at least 1 character(s)');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a zero interval rather than one that would instantly come due', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: filled({ intervalKm: '0' }),
      submitLabel: 'Save reminder',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save reminder');

    expect(textOf(tree)).toContain('Interval in kilometres must be at least 1');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a single-condition reminder when the other is cleared', async () => {
    const onSubmit = jest.fn();
    const tree = await renderForm({
      initial: {
        ...BLANK_REMINDER,
        title: 'Coolant flush',
        dueOdometerKm: '50000',
      },
      submitLabel: 'Save reminder',
      pending: false,
      onSubmit,
    });

    await press(tree, 'Save reminder');

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Coolant flush', dueOdometerKm: 50_000 }),
    );
  });
});
