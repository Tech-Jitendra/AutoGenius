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
  createServiceRecordSchema,
  SERVICE_TYPES,
  type CreateServiceRecordInput,
  type ServiceTypeInput,
  type UpdateServiceRecordInput,
} from '@autogenius/validation';
import { validateForm, type FieldErrors } from '../auth/form-validation';
import { Choices, Field } from '../vehicles/vehicle-form';
import { costLabel, humanizeEnum, totalCostInPaise } from './labels';
import type { ServiceRecordDto } from './types';

/** One `parts_replaced` line, held as text because that is what the inputs edit. */
export interface PartRow {
  name: string;
  quantity: string;
  cost: string;
}

export interface ServiceRecordFormValues {
  serviceDate: string;
  odometerKm: string;
  workshopName: string;
  serviceType: ServiceTypeInput | '';
  description: string;
  parts: PartRow[];
  labourCost: string;
  partsCost: string;
  otherCost: string;
  notes: string;
}

/**
 * The API compares dates against UTC midnight, so "today" here is the UTC
 * calendar day — the same day the server will reject a future date against.
 */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const BLANK_RECORD: ServiceRecordFormValues = {
  serviceDate: '',
  odometerKm: '',
  workshopName: '',
  serviceType: '',
  description: '',
  parts: [],
  labourCost: '',
  partsCost: '',
  otherCost: '',
  notes: '',
};

export function recordToFormValues(record: ServiceRecordDto): ServiceRecordFormValues {
  return {
    serviceDate: record.serviceDate,
    odometerKm: record.odometerKm === null ? '' : String(record.odometerKm),
    workshopName: record.workshopName ?? '',
    serviceType: record.serviceType,
    description: record.description ?? '',
    parts: record.partsReplaced.map((part) => ({
      name: part.name,
      quantity: part.quantity === null ? '' : String(part.quantity),
      cost: part.cost === null ? '' : String(part.cost),
    })),
    labourCost: String(record.labourCost),
    partsCost: String(record.partsCost),
    otherCost: String(record.otherCost),
    notes: record.notes ?? '',
  };
}

/** An empty part line means "no part yet", not a part with a missing name. */
export function filledParts(values: ServiceRecordFormValues): PartRow[] {
  return values.parts.filter((part) => part.name.trim() !== '');
}

function toPayload(values: ServiceRecordFormValues): Record<string, unknown> {
  return {
    serviceDate: values.serviceDate,
    odometerKm: values.odometerKm,
    workshopName: values.workshopName,
    serviceType: values.serviceType,
    description: values.description,
    partsReplaced: filledParts(values),
    labourCost: values.labourCost,
    partsCost: values.partsCost,
    otherCost: values.otherCost,
    notes: values.notes,
  };
}

/**
 * Costs are never nullable columns, so a blank cost is sent as 0 rather than
 * null. Optional text and the odometer go out as null so a PATCH clears them.
 */
export function toUpdateRecordInput(input: CreateServiceRecordInput): UpdateServiceRecordInput {
  return {
    ...input,
    odometerKm: input.odometerKm ?? null,
    workshopName: input.workshopName ?? null,
    description: input.description ?? null,
    notes: input.notes ?? null,
    labourCost: input.labourCost ?? 0,
    partsCost: input.partsCost ?? 0,
    otherCost: input.otherCost ?? 0,
    partsReplaced: input.partsReplaced ?? [],
  };
}

function amount(raw: string): number {
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : 0;
}

/**
 * The server always recomputes `total_cost` as labour + parts + other; this is
 * the same sum, taken in whole paise so the preview cannot drift on a float.
 */
export function previewTotalCost(values: ServiceRecordFormValues): string {
  const paise = totalCostInPaise(
    amount(values.labourCost),
    amount(values.partsCost),
    amount(values.otherCost),
  );
  return costLabel(paise / 100);
}

interface ServiceRecordFormProps {
  initial?: ServiceRecordFormValues;
  submitLabel: string;
  pending: boolean;
  serverError?: string | null;
  onSubmit: (input: CreateServiceRecordInput) => void;
}

export function ServiceRecordForm({
  initial = BLANK_RECORD,
  submitLabel,
  pending,
  serverError = null,
  onSubmit,
}: ServiceRecordFormProps) {
  const [values, setValues] = useState<ServiceRecordFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = <K extends keyof ServiceRecordFormValues>(key: K, value: ServiceRecordFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const setPart = (index: number, key: keyof PartRow, value: string) => {
    setValues((current) => ({
      ...current,
      parts: current.parts.map((part, position) =>
        position === index ? { ...part, [key]: value } : part,
      ),
    }));
  };

  const submit = () => {
    const result = validateForm(createServiceRecordSchema, toPayload(values));
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    onSubmit(result.values);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field label="Service date" error={fieldErrors['serviceDate']}>
        <TextInput
          style={styles.input}
          value={values.serviceDate}
          onChangeText={(text) => set('serviceDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          accessibilityLabel="Service date"
        />
      </Field>

      <Field label="Type of service" error={fieldErrors['serviceType']}>
        <Choices
          options={SERVICE_TYPES}
          value={values.serviceType}
          onChange={(choice) => set('serviceType', choice as ServiceTypeInput | '')}
          label="Type of service"
          formatOption={humanizeEnum}
        />
      </Field>

      <Field label="Workshop name (optional)" error={fieldErrors['workshopName']}>
        <TextInput
          style={styles.input}
          value={values.workshopName}
          onChangeText={(text) => set('workshopName', text)}
          placeholder="City Auto Care"
          autoCapitalize="words"
          accessibilityLabel="Workshop name"
        />
      </Field>

      <Field label="Odometer reading in km (optional)" error={fieldErrors['odometerKm']}>
        <TextInput
          style={styles.input}
          value={values.odometerKm}
          onChangeText={(text) => set('odometerKm', text)}
          placeholder="42000"
          keyboardType="number-pad"
          accessibilityLabel="Service odometer"
        />
      </Field>

      <Field label="Work performed (optional)" error={fieldErrors['description']}>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={values.description}
          onChangeText={(text) => set('description', text)}
          placeholder="Front brake pads replaced, rotors skimmed"
          multiline
          accessibilityLabel="Work performed"
        />
      </Field>

      <Field label="Parts replaced (optional)" error={fieldErrors['partsReplaced']}>
        {values.parts.map((part, index) => (
          <View key={index} style={styles.partRow}>
            <TextInput
              style={[styles.input, styles.partName]}
              value={part.name}
              onChangeText={(text) => setPart(index, 'name', text)}
              placeholder="Part name"
              autoCapitalize="words"
              accessibilityLabel={`Part ${index + 1} name`}
            />
            <TextInput
              style={[styles.input, styles.partSmall]}
              value={part.quantity}
              onChangeText={(text) => setPart(index, 'quantity', text)}
              placeholder="Qty"
              keyboardType="number-pad"
              accessibilityLabel={`Part ${index + 1} quantity`}
            />
            <TextInput
              style={[styles.input, styles.partSmall]}
              value={part.cost}
              onChangeText={(text) => setPart(index, 'cost', text)}
              placeholder="₹"
              keyboardType="decimal-pad"
              accessibilityLabel={`Part ${index + 1} cost`}
            />
            <Pressable
              onPress={() =>
                set(
                  'parts',
                  values.parts.filter((_, position) => position !== index),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Remove part ${index + 1}`}
            >
              <Text style={styles.removePart}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={({ pressed }) => [styles.addPart, pressed && styles.pressed]}
          onPress={() => set('parts', [...values.parts, { name: '', quantity: '', cost: '' }])}
          accessibilityRole="button"
          accessibilityLabel="Add part"
        >
          <Text style={styles.addPartText}>Add part</Text>
        </Pressable>

        <Text style={styles.hint}>
          Part prices are notes for the bill. The billed totals below are what AutoGenius adds up
          as the cost of this visit.
        </Text>
      </Field>

      <Field label="Labour cost (optional)" error={fieldErrors['labourCost']}>
        <TextInput
          style={styles.input}
          value={values.labourCost}
          onChangeText={(text) => set('labourCost', text)}
          placeholder="0"
          keyboardType="decimal-pad"
          accessibilityLabel="Labour cost"
        />
      </Field>

      <Field label="Parts cost (optional)" error={fieldErrors['partsCost']}>
        <TextInput
          style={styles.input}
          value={values.partsCost}
          onChangeText={(text) => set('partsCost', text)}
          placeholder="0"
          keyboardType="decimal-pad"
          accessibilityLabel="Parts cost"
        />
      </Field>

      <Field label="Other cost (optional)" error={fieldErrors['otherCost']}>
        <TextInput
          style={styles.input}
          value={values.otherCost}
          onChangeText={(text) => set('otherCost', text)}
          placeholder="0"
          keyboardType="decimal-pad"
          accessibilityLabel="Other cost"
        />
      </Field>

      <View style={styles.total}>
        <Text style={styles.totalLabel}>Total for this visit</Text>
        <Text style={styles.totalValue}>{previewTotalCost(values)}</Text>
      </View>

      <Field label="Notes (optional)" error={fieldErrors['notes']}>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={values.notes}
          onChangeText={(text) => set('notes', text)}
          placeholder="Anything worth remembering next time"
          multiline
          accessibilityLabel="Notes"
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
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  partName: {
    flex: 3,
  },
  partSmall: {
    flex: 1,
  },
  removePart: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  addPart: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#1f6feb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addPartText: {
    color: '#1f6feb',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    marginTop: 8,
    color: '#555',
    fontSize: 12,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eaf2ff',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f6feb',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6feb',
  },
  formError: {
    marginVertical: 10,
    color: '#c0392b',
    fontSize: 14,
  },
  submit: {
    marginTop: 8,
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
