import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshTokenEntity } from './refresh-token.entity';
import { hashRefreshToken } from './token-hash';

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokens: Repository<RefreshTokenEntity>,
  ) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenEntity> {
    const entity = this.tokens.create({
      id: crypto.randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
    });
    return this.tokens.save(entity);
  }

  async findByPresentedToken(
    presentedToken: string,
  ): Promise<RefreshTokenEntity | null> {
    return this.tokens.findOne({
      where: { tokenHash: hashRefreshToken(presentedToken) },
    });
  }

  async revoke(
    token: RefreshTokenEntity,
    replacedById?: string,
  ): Promise<void> {
    token.revokedAt = new Date();
    if (replacedById) {
      token.replacedById = replacedById;
    }
    await this.tokens.save(token);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
