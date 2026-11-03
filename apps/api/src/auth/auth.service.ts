import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { LoginInput, RegisterInput } from '@autogenius/validation';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/user.entity';
import { PasswordHasher } from './password-hasher';
import { AuthTokens, TokensService } from './tokens.service';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokensService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const exists = await this.users.existsByEmail(input.email);
    if (exists) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
    });
    const tokens = await this.tokens.issueTokenPair(user);
    return { user: toPublicUser(user), ...tokens };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmailWithPassword(input.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.tokens.issueTokenPair(user);
    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(presentedRefreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotateRefreshToken(presentedRefreshToken);
  }

  async logout(presentedRefreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(presentedRefreshToken);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }
}

export function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
