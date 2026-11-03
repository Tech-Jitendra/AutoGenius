import { loginSchema, registerSchema } from '@autogenius/validation';
import { validateForm } from './form-validation';

describe('validateForm', () => {
  it('passes a valid login payload through with parsed values', () => {
    const result = validateForm(loginSchema, { email: 'a@b.com', password: 'whatever' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values.email).toBe('a@b.com');
    }
  });

  it('maps a bad login email to the email field', () => {
    const result = validateForm(loginSchema, { email: 'nope', password: 'whatever' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['email']).toBeTruthy();
    }
  });

  it('maps a short register password to the password field', () => {
    const result = validateForm(registerSchema, {
      name: 'A',
      email: 'a@b.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['password']).toBeTruthy();
    }
  });

  it('maps an invalid register phone to the phone field', () => {
    const result = validateForm(registerSchema, {
      name: 'A',
      email: 'a@b.com',
      phone: 'abc',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['phone']).toBeTruthy();
    }
  });

  it('reports multiple field errors at once', () => {
    const result = validateForm(registerSchema, { name: '', email: 'nope', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['name']).toBeTruthy();
      expect(result.errors['email']).toBeTruthy();
      expect(result.errors['password']).toBeTruthy();
    }
  });

  it('accepts a valid registration without phone', () => {
    const result = validateForm(registerSchema, {
      name: 'Jitendra',
      email: 'a@b.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values.phone).toBeUndefined();
    }
  });
});
