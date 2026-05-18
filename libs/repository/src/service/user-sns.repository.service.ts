import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserSnsEntity } from '../entity/user-sns.entity';
import { UserSnsProvider } from '../enum/user-sns.enum';

export interface CreateUserSnsDto {
  userId: number;
  provider: UserSnsProvider;
  providerUserId: string;
  providerEmail: string | null;
}

@Injectable()
export class UserSnsRepositoryService {
  constructor(
    @InjectRepository(UserSnsEntity)
    private readonly userSnsRepository: Repository<UserSnsEntity>,
  ) {}

  async findByProvider(
    provider: UserSnsProvider,
    providerUserId: string,
  ): Promise<UserSnsEntity | null> {
    return await this.userSnsRepository.findOneBy({
      provider,
      providerUserId,
    });
  }

  async findByUserAndProvider(
    userId: number,
    provider: UserSnsProvider,
  ): Promise<UserSnsEntity | null> {
    return await this.userSnsRepository.findOneBy({
      userId,
      provider,
    });
  }

  async createUserSns(userSns: CreateUserSnsDto): Promise<UserSnsEntity> {
    return await this.userSnsRepository.save(userSns);
  }
}
