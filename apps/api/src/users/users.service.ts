import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeEmail } from '@autogenius/validation';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async create(input: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    const entity = this.users.create({
      id: crypto.randomUUID(),
      name: input.name,
      email: normalizeEmail(input.email),
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
    });
    return this.users.save(entity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  async findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }
}
