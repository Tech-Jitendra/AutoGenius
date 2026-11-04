import { registerUser, loginUser, getMe } from '../lib/api/auth-api';
import { setClientSession } from '../lib/api/client';
import { registerSchema } from '@autogenius/validation';
import { validateForm } from '../auth/form-validation';

const stamp = Date.now();
const email = `probe-${stamp}@autogenius.test`;

it('probe: register with the realistic Indian phone the user types', () => {
  for (const phone of ['9876543210', '+919876543210', '+91 98765 43210', '98765 43210']) {
    const r = validateForm(registerSchema, {
      name: 'Probe User',
      email,
      phone,
      password: 'Sup3rSecret!',
    });
    console.log(`PHONE ${phone} -> ${JSON.stringify(r.success ? r.values : r.errors)}`);
  }
});

it('probe: live mobile register path (phone omitted)', async () => {
  const result = validateForm(registerSchema, {
    name: 'Probe User',
    email,
    phone: undefined,
    password: 'Sup3rSecret!',
  });
  console.log('VALIDATION ' + JSON.stringify(result));
  if (!result.success) return;

  const response = await registerUser(result.values);
  console.log('REGISTER ' + JSON.stringify(response).slice(0, 200));

  setClientSession(response);
  const me = await getMe();
  console.log('ME ' + JSON.stringify(me));

  const login = await loginUser({ email, password: 'Sup3rSecret!' });
  console.log('LOGIN ok=' + Boolean(login.accessToken));
}, 30000);
