import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import RegisterScreen from '../app/(auth)/register';
import { ApiError } from '../lib/api/client';

jest.mock('expo-router', () => ({
  Link: () => null,
  router: { push: jest.fn(), replace: jest.fn() },
}));

const mockSignUp = jest.fn();
jest.mock('./auth-context', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: (input: unknown) => mockSignUp(input),
  }),
}));

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

async function fillAndSubmit(
  values: Record<string, string>,
): Promise<{ tree: ReturnType<typeof create>; body: string }> {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<RegisterScreen />);
  });
  for (const [placeholder, value] of Object.entries(values)) {
    const input = tree.root.findAllByProps({ placeholder })[0];
    await act(async () => {
      input.props.onChangeText(value);
    });
  }
  const button = tree.root.findAllByProps({ accessibilityRole: 'button' })[0];
  await act(async () => {
    button.props.onPress();
  });
  // Let the awaited signUp promise settle and the state update flush.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return { tree, body: textOf(tree) };
}

const validDetails = {
  'Full name': 'Jitendra',
  Email: 'jitendra@example.com',
  'Phone (optional)': '+91 98765 43210',
  'Password (minimum 8 characters)': 'password123',
};

describe('register screen', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  it('submits a formatted phone number instead of rejecting it', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);

    await fillAndSubmit(validDetails);

    expect(mockSignUp).toHaveBeenCalledWith({
      name: 'Jitendra',
      email: 'jitendra@example.com',
      phone: '+919876543210',
      password: 'password123',
    });
  });

  it('leaves an empty optional phone out of the request', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);

    await fillAndSubmit({ ...validDetails, 'Phone (optional)': '' });

    const payload = mockSignUp.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['phone']).toBeUndefined();
    // JSON.stringify drops undefined, so the field never reaches the API as ''.
    expect(JSON.stringify(payload)).not.toContain('phone');
  });

  it('reports which address it could not reach when the API is unreachable', async () => {
    mockSignUp.mockRejectedValueOnce(
      new ApiError(0, 'Cannot reach the AutoGenius API at http://10.0.2.2:3001.'),
    );

    const { body } = await fillAndSubmit(validDetails);

    expect(body).toContain('Cannot reach the AutoGenius API at http://10.0.2.2:3001');
    expect(body).not.toContain('Something went wrong');
  });

  it('shows the server message when the email is already registered', async () => {
    mockSignUp.mockRejectedValueOnce(new ApiError(409, 'Email already registered'));

    const { body } = await fillAndSubmit(validDetails);

    expect(body).toContain('Email already registered');
  });

  it('keeps a generic message for unexpected failures', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('boom'));

    const { body } = await fillAndSubmit(validDetails);

    expect(body).toContain('Something went wrong. Please try again.');
  });

  it('blocks the request and names the field when the password is too short', async () => {
    const { body } = await fillAndSubmit({
      ...validDetails,
      'Password (minimum 8 characters)': 'short',
    });

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(body).toContain('at least 8 character');
  });
});
