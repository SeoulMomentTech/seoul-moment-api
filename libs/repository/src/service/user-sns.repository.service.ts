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

  /** user 1 : sns 1 이므로 userId 만으로 연결된 SNS 를 찾는다. */
  async findByUserId(userId: number): Promise<UserSnsEntity | null> {
    return await this.userSnsRepository.findOneBy({ userId });
  }

  async createUserSns(userSns: CreateUserSnsDto): Promise<UserSnsEntity> {
    return await this.userSnsRepository.save(userSns);
  }
}
