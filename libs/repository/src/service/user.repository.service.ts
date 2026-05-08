import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import {
  UpdateUserDto,
  UpdateUserFitDto,
  UpdateUserProfileDto,
} from '../dto/user.dto';
import { UserFitEntity } from '../entity/user-fit.entity';
import { UserProfileEntity } from '../entity/user-profile.entity';
import { UserEntity } from '../entity/user.entity';

@Injectable()
export class UserRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(UserProfileEntity)
    private readonly userProfileRepository: Repository<UserProfileEntity>,

    @InjectRepository(UserFitEntity)
    private readonly userFitRepository: Repository<UserFitEntity>,
  ) {}

  async createUser(user: UserEntity): Promise<UserEntity> {
    return await this.userRepository.save(user);
  }

  async findUserByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();
  }

  async updateUser(updateDto: UpdateUserDto): Promise<UserEntity> {
    return await this.userRepository.save(updateDto);
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

  async getUserInfo(id: number): Promise<UserEntity> {
    const result = await this.userRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    return result;
  }

  async createUserProfile(
    userProfile: UserProfileEntity,
  ): Promise<UserProfileEntity> {
    return await this.userProfileRepository.save(userProfile);
  }

  async updateUserProfile(
    userProfile: UpdateUserProfileDto,
  ): Promise<UserProfileEntity> {
    return await this.userProfileRepository.save(userProfile);
  }

  async getUserProfile(userId: number): Promise<UserProfileEntity> {
    const result = await this.userProfileRepository.findOne({
      where: { userId },
      relations: { user: true },
    });

    if (!result) {
      throw new ServiceError(
        'User profile not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async existUserByEmail(email: string): Promise<boolean> {
    const result = await this.userRepository.exists({ where: { email } });

    return result;
  }

  async getUserByEmail(email: string): Promise<UserEntity> {
    const result = await this.userRepository.findOneBy({ email });

    if (!result) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    return result;
  }

  async createUserFit(userFit: UserFitEntity): Promise<UserFitEntity> {
    const existing = await this.userFitRepository.findOne({
      where: { userId: userFit.userId },
      withDeleted: true,
    });

    if (existing?.deleteDate) {
      await this.userFitRepository.restore({ userId: userFit.userId });
    }

    return await this.userFitRepository.save(userFit);
  }

  async updateUserFit(userFit: UpdateUserFitDto): Promise<UserFitEntity> {
    return await this.userFitRepository.save(userFit);
  }

  async getUserFit(userId: number): Promise<UserFitEntity> {
    const result = await this.userFitRepository.findOneBy({ userId });

    if (!result) {
      throw new ServiceError(
        'User fit not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async softDeleteUserFit(userId: number): Promise<void> {
    await this.userFitRepository.softDelete({ userId });
  }

  async validateUserNickname(
    nickname: string,
    excludeUserId?: number,
  ): Promise<void> {
    const where =
      excludeUserId !== undefined
        ? { nickname, id: Not(excludeUserId) }
        : { nickname };
    const result = await this.userRepository.findOneBy(where);

    if (result) {
      throw new ServiceError(
        'User nickname already exists',
        ServiceErrorCode.CONFLICT,
      );
    }
  }
}
