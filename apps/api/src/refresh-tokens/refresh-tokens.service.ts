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
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenEntity> {
    const entity = this.tokens.create({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
    });
    return this.tokens.save(entity);
  }

  /**
   * Atomically transitions one token from active to revoked. PostgreSQL
   * serializes concurrent UPDATEs on the same row, so when two requests
   * present the same token only one of them sees `affected` = 1; the other is
   * how a rotated token being replayed is caught.
   */
  async claim(oldTokenId: string, replacedById: string): Promise<boolean> {
    const result = await this.tokens.update(
      { id: oldTokenId, revokedAt: IsNull() },
      { revokedAt: new Date(), replacedById },
    );
    return (result.affected ?? 0) === 1;
  }

  async findByPresentedToken(
    presentedToken: string,
  ): Promise<RefreshTokenEntity | null> {
    return this.tokens.findOne({
      where: { tokenHash: hashRefreshToken(presentedToken) },
    });
  }

  async revoke(token: RefreshTokenEntity): Promise<void> {
    token.revokedAt = new Date();
    await this.tokens.save(token);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
