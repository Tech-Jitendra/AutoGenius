export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

export interface Session extends AuthResponse {}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
