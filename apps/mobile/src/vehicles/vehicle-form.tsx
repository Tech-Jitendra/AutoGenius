import { useState } from 'react';
import type { ReactNode } from 'react';
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
  createVehicleSchema,
  FUEL_TYPES,
  TRANSMISSION_TYPES,
  type CreateVehicleInput,
  type FuelTypeInput,
  type TransmissionInput,
  type UpdateVehicleInput,
} from '@autogenius/validation';
import { validateForm, type FieldErrors } from '../auth/form-validation';
import { titleCase } from './labels';
import type { VehicleDto } from './types';

export interface VehicleFormValues {
  make: string;
  model: string;
  variant: string;
  registrationNumber: string;
  manufacturingYear: string;
  fuelType: FuelTypeInput | '';
  transmission: TransmissionInput | '';
  purchaseDate: string;
  currentOdometer: string;
}

const BLANK: VehicleFormValues = {
  make: '',
  model: '',
  variant: '',
  registrationNumber: '',
  manufacturingYear: '',
  fuelType: '',
  transmission: '',
  purchaseDate: '',
  currentOdometer: '',
};

export function vehicleToFormValues(vehicle: VehicleDto): VehicleFormValues {
  return {
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant ?? '',
    registrationNumber: vehicle.registrationNumber ?? '',
    manufacturingYear: String(vehicle.manufacturingYear),
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    purchaseDate: vehicle.purchaseDate ?? '',
    currentOdometer: vehicle.currentOdometer === null ? '' : String(vehicle.currentOdometer),
  };
}

/**
 * Optional fields are sent as null when blank so a PATCH clears them instead of
 * leaving the previous value in place.
 */
export function toUpdateInput(values: CreateVehicleInput): UpdateVehicleInput {
  return {
    ...values,
    variant: values.variant ?? null,
    registrationNumber: values.registrationNumber ?? null,
    purchaseDate: values.purchaseDate ?? null,
    currentOdometer: values.currentOdometer ?? null,
  };
}

interface VehicleFormProps {
  initial?: VehicleFormValues;
  submitLabel: string;
  pending: boolean;
  serverError?: string | null;
  onSubmit: (values: CreateVehicleInput) => void;
}

export function VehicleForm({
  initial = BLANK,
  submitLabel,
  pending,
  serverError = null,
  onSubmit,
}: VehicleFormProps) {
  const [values, setValues] = useState<VehicleFormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = <K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    const result = validateForm(createVehicleSchema, {
      make: values.make,
      model: values.model,
      variant: values.variant,
      registrationNumber: values.registrationNumber,
      manufacturingYear: values.manufacturingYear,
      fuelType: values.fuelType,
      transmission: values.transmission,
      purchaseDate: values.purchaseDate,
      currentOdometer: values.currentOdometer,
    });
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
      <Field label="Make" error={fieldErrors['make']}>
        <TextInput
          style={styles.input}
          value={values.make}
          onChangeText={(text) => set('make', text)}
          placeholder="Maruti Suzuki"
          autoCapitalize="words"
          accessibilityLabel="Make"
        />
      </Field>

      <Field label="Model" error={fieldErrors['model']}>
        <TextInput
          style={styles.input}
          value={values.model}
          onChangeText={(text) => set('model', text)}
          placeholder="Baleno"
          autoCapitalize="words"
          accessibilityLabel="Model"
        />
      </Field>

      <Field label="Variant (optional)" error={fieldErrors['variant']}>
        <TextInput
          style={styles.input}
          value={values.variant}
          onChangeText={(text) => set('variant', text)}
          placeholder="ZXi CVT"
          autoCapitalize="words"
          accessibilityLabel="Variant"
        />
      </Field>

      <Field label="Registration number (optional)" error={fieldErrors['registrationNumber']}>
        <TextInput
          style={styles.input}
          value={values.registrationNumber}
          onChangeText={(text) => set('registrationNumber', text)}
          placeholder="MH 12 AB 1234"
          autoCapitalize="characters"
          accessibilityLabel="Registration number"
        />
      </Field>

      <Field label="Manufacturing year" error={fieldErrors['manufacturingYear']}>
        <TextInput
          style={styles.input}
          value={values.manufacturingYear}
          onChangeText={(text) => set('manufacturingYear', text)}
          placeholder="2019"
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Manufacturing year"
        />
      </Field>

      <Field label="Fuel type" error={fieldErrors['fuelType']}>
        <Choices
          options={FUEL_TYPES}
          value={values.fuelType}
          onChange={(choice) => set('fuelType', choice as FuelTypeInput | '')}
          label="Fuel type"
        />
      </Field>

      <Field label="Transmission" error={fieldErrors['transmission']}>
        <Choices
          options={TRANSMISSION_TYPES}
          value={values.transmission}
          onChange={(choice) => set('transmission', choice as TransmissionInput | '')}
          label="Transmission"
        />
      </Field>

      <Field label="Purchase date (optional)" error={fieldErrors['purchaseDate']}>
        <TextInput
          style={styles.input}
          value={values.purchaseDate}
          onChangeText={(text) => set('purchaseDate', text)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          accessibilityLabel="Purchase date"
        />
      </Field>

      <Field label="Odometer reading in km (optional)" error={fieldErrors['currentOdometer']}>
        <TextInput
          style={styles.input}
          value={values.currentOdometer}
          onChangeText={(text) => set('currentOdometer', text)}
          placeholder="42000"
          keyboardType="number-pad"
          accessibilityLabel="Odometer reading"
        />
      </Field>

      {serverError ? <Text style={styles.formError}>{serverError}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.submit, (pressed || pending) && styles.submitPressed]}
        onPress={submit}
        disabled={pending}
        accessibilityRole="button"
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Choices({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly string[];
  value: string;
  onChange: (choice: string) => void;
  label: string;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.choice,
              selected && styles.choiceSelected,
              pressed && styles.choicePressed,
            ]}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option}`}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {titleCase(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  field: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
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
  fieldError: {
    marginTop: 4,
    color: '#c0392b',
    fontSize: 12,
  },
  formError: {
    marginVertical: 10,
    color: '#c0392b',
    fontSize: 14,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  choiceSelected: {
    borderColor: '#1f6feb',
    backgroundColor: '#eaf2ff',
  },
  choicePressed: {
    opacity: 0.7,
  },
  choiceText: {
    fontSize: 14,
    color: '#333',
  },
  choiceTextSelected: {
    color: '#1f6feb',
    fontWeight: '600',
  },
  submit: {
    marginTop: 8,
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitPressed: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
