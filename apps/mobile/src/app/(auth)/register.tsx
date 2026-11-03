import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { Link } from 'expo-router';
import { registerSchema } from '@autogenius/validation';
import { APP_NAME } from '@autogenius/constants';
import { useAuth } from '../../auth/auth-context';
import { validateForm } from '../../auth/form-validation';
import { ApiError } from '../../lib/api/client';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async () => {
    setFormError(null);
    const input = {
      name,
      email,
      phone: phone.trim() === '' ? undefined : phone.trim(),
      password,
    };
    const result = validateForm(registerSchema, input);
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await signUp(result.values);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          accessibilityLabel="Full name"
        />
        {fieldErrors['name'] ? <Text style={styles.fieldError}>{fieldErrors['name']}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        {fieldErrors['email'] ? <Text style={styles.fieldError}>{fieldErrors['email']}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Phone (optional)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          accessibilityLabel="Phone"
        />
        {fieldErrors['phone'] ? <Text style={styles.fieldError}>{fieldErrors['phone']}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Password (minimum 8 characters)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />
        {fieldErrors['password'] ? (
          <Text style={styles.fieldError}>{fieldErrors['password']}</Text>
        ) : null}

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || pending) && styles.buttonPressed]}
          onPress={onSubmit}
          disabled={pending}
          accessibilityRole="button"
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/login" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    fontSize: 15,
    textAlign: 'center',
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  fieldError: {
    color: '#c0392b',
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  formError: {
    color: '#c0392b',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: '#1f6feb',
    fontSize: 14,
  },
});
