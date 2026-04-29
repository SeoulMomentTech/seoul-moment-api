import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UpdateUserDto } from '../dto/user.dto';
import { UserEntity } from '../entity/user.entity';

@Injectable()
export class UserRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async createUser(user: UserEntity): Promise<UserEntity> {
    return this.userRepository.save(user);
  }

  async findUserByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();
  }

  async updateUser(updateDto: UpdateUserDto): Promise<UserEntity> {
    return this.userRepository.save(updateDto);
  }

  async getUserById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    return user;
  }

  async getUserByIdWithRefreshToken(id: number): Promise<UserEntity> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .addSelect('user.refreshToken')
      .getOne();

    if (!user) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    return user;
  }
}
