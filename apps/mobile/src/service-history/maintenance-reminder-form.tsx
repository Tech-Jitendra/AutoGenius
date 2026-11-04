import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createMaintenanceReminderSchema,
  type CreateMaintenanceReminderInput,
  type UpdateMaintenanceReminderInput,
} from '@autogenius/validation';
import { validateForm, type FieldErrors } from '../auth/form-validation';
import { Field } from '../vehicles/vehicle-form';
import type { MaintenanceReminderDto } from './types';

export interface ReminderFormValues {
  title: string;
  description: string;
  dueDate: string;
  dueOdometerKm: string;
  intervalMonths: string;
  intervalKm: string;
  lastCompletedDate: string;
  lastCompletedOdometerKm: string;
}

export const BLANK_REMINDER: ReminderFormValues = {
  title: '',
  description: '',
  dueDate: '',
  dueOdometerKm: '',
  intervalMonths: '',
  intervalKm: '',
  lastCompletedDate: '',
  lastCompletedOdometerKm: '',
};

export function reminderToFormValues(reminder: MaintenanceReminderDto): ReminderFormValues {
  const text = (value: string | number | null): string => (value === null ? '' : String(value));
  return {
    title: reminder.title,
    description: reminder.description ?? '',
    dueDate: text(reminder.dueDate),
    dueOdometerKm: text(reminder.dueOdometerKm),
    intervalMonths: text(reminder.intervalMonths),
    intervalKm: text(reminder.intervalKm),
    lastCompletedDate: text(reminder.lastCompletedDate),
    lastCompletedOdometerKm: text(reminder.lastCompletedOdometerKm),
  };
}

function toPayload(values: ReminderFormValues): Record<string, unknown> {
  return { ...values };
}

/**
 * Every field goes out, with null for the blanks, so a PATCH clears what the
 * user emptied instead of silently keeping the old value.
 */
export function toUpdateReminderInput(
  input: CreateMaintenanceReminderInput,
): UpdateMaintenanceReminderInput {
  return {
    title: input.title,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
    dueOdometerKm: input.dueOdometerKm ?? null,
    intervalMonths: input.intervalMonths ?? null,
    intervalKm: input.intervalKm ?? null,
    lastCompletedDate: input.lastCompletedDate ?? null,
    lastCompletedOdometerKm: input.lastCompletedOdometerKm ?? null,
  };
}

interface ReminderFormProps {
  initial?: ReminderFormValues;
  submitLabel: string;
  pending: boolean;
  serverError?: string | null;
  onSubmit: (input: CreateMaintenanceReminderInput) => void;
}

export function MaintenanceReminderForm({
  initial = BLANK_REMINDER,
  submitLabel,
  pending,
  serverError = null,
  onSubmit,
}: ReminderFormProps) {
  const [values, setValues] = useState<ReminderFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = <K extends keyof ReminderFormValues>(key: K, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    // The create schema is used for both screens: the payload always carries
    // every field, so "needs a due date or a due odometer" can be checked here
    // exactly the way the server checks the merged reminder.
    const result = validateForm(createMaintenanceReminderSchema, toPayload(values));
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    onSubmit(result.values);
  };

  // A rule about the pair of fields has no single field to sit under.
  const formError = fieldErrors['form'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field label="What is due?" error={fieldErrors['title']}>
        <TextInput
          style={styles.input}
          value={values.title}
          onChangeText={(text) => set('title', text)}
          placeholder="Oil change"
          autoCapitalize="sentences"
          accessibilityLabel="Reminder title"
        />
      </Field>

      <Field label="Details (optional)" error={fieldErrors['description']}>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={values.description}
          onChangeText={(text) => set('description', text)}
          placeholder="0W-20 every 10,000 km, per the service book"
          multiline
          accessibilityLabel="Reminder details"
        />
      </Field>

      <Text style={styles.sectionTitle}>When it becomes due</Text>
      {formError ? <Text style={styles.pairError}>{formError}</Text> : null}

      <Field label="Due date (optional)" error={fieldErrors['dueDate']}>
        <TextInput
          style={styles.input}
          value={values.dueDate}
          onChangeText={(text) => set('dueDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          accessibilityLabel="Due date"
        />
      </Field>

      <Field label="Due odometer in km (optional)" error={fieldErrors['dueOdometerKm']}>
        <TextInput
          style={styles.input}
          value={values.dueOdometerKm}
          onChangeText={(text) => set('dueOdometerKm', text)}
          placeholder="45000"
          keyboardType="number-pad"
          accessibilityLabel="Due odometer"
        />
      </Field>

      <Text style={styles.sectionTitle}>Repeat interval (optional)</Text>
      <Text style={styles.hint}>
        With an interval the reminder rolls forward every time you complete it. Without one it is
        a single reminder that stays completed.
      </Text>

      <Field label="Every N months" error={fieldErrors['intervalMonths']}>
        <TextInput
          style={styles.input}
          value={values.intervalMonths}
          onChangeText={(text) => set('intervalMonths', text)}
          placeholder="6"
          keyboardType="number-pad"
          accessibilityLabel="Interval in months"
        />
      </Field>

      <Field label="Every N km" error={fieldErrors['intervalKm']}>
        <TextInput
          style={styles.input}
          value={values.intervalKm}
          onChangeText={(text) => set('intervalKm', text)}
          placeholder="10000"
          keyboardType="number-pad"
          accessibilityLabel="Interval in kilometres"
        />
      </Field>

      <Text style={styles.sectionTitle}>Last completed (optional)</Text>
      <Text style={styles.hint}>
        Only needed when you are moving an existing service book into AutoGenius. A completion
        you mark later overwrites these values.
      </Text>

      <Field label="Completion date" error={fieldErrors['lastCompletedDate']}>
        <TextInput
          style={styles.input}
          value={values.lastCompletedDate}
          onChangeText={(text) => set('lastCompletedDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          accessibilityLabel="Last completion date"
        />
      </Field>

      <Field label="Odometer at completion" error={fieldErrors['lastCompletedOdometerKm']}>
        <TextInput
          style={styles.input}
          value={values.lastCompletedOdometerKm}
          onChangeText={(text) => set('lastCompletedOdometerKm', text)}
          placeholder="35000"
          keyboardType="number-pad"
          accessibilityLabel="Odometer at last completion"
        />
      </Field>

      {serverError ? <Text style={styles.formError}>{serverError}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.submit, (pressed || pending) && styles.pressed]}
        onPress={submit}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
      >
        {pending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  hint: {
    marginBottom: 12,
    color: '#555',
    fontSize: 12,
  },
  pairError: {
    marginBottom: 10,
    color: '#c0392b',
    fontSize: 12,
  },
  formError: {
    marginVertical: 10,
    color: '#c0392b',
    fontSize: 14,
  },
  submit: {
    marginTop: 20,
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
