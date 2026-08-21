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
import { UserProfileImageEntity } from '../entity/user-profile-image.entity';
import { UserProfileEntity } from '../entity/user-profile.entity';
import { UserEntity } from '../entity/user.entity';

@Injectable()
export class UserRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(UserProfileEntity)
    private readonly userProfileRepository: Repository<UserProfileEntity>,

    @InjectRepository(UserProfileImageEntity)
    private readonly userProfileImageRepository: Repository<UserProfileImageEntity>,

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

  /**
   * 소프트 삭제(탈퇴)된 회원은 제외하고 조회한다. 인증 단계에서 "회원이
   * 없다"를 404가 아니라 401로 다루기 위해 예외 대신 null 을 돌려준다.
   */
  async findUserById(id: number): Promise<UserEntity | null> {
    return await this.userRepository.findOneBy({ id });
  }

  /** 탈퇴 회원 제외. 없으면 null (인증 단계 전용). */
  async findUserByIdWithRefreshToken(id: number): Promise<UserEntity | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .addSelect('user.refreshToken')
      .getOne();
  }

  async getUserByIdWithRefreshToken(id: number): Promise<UserEntity> {
    const user = await this.findUserByIdWithRefreshToken(id);

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
      relations: { user: true, image: true },
    });

    if (!result) {
      throw new ServiceError(
        'User profile not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findUserProfile(userId: number): Promise<UserProfileEntity | null> {
    return await this.userProfileRepository.findOne({
      where: { userId },
      relations: { user: true, image: true },
    });
  }

  async createUserProfileImage(
    image: UserProfileImageEntity,
  ): Promise<UserProfileImageEntity> {
    return await this.userProfileImageRepository.save(image);
  }

  async findUserProfileImage(
    userId: number,
  ): Promise<UserProfileImageEntity | null> {
    return await this.userProfileImageRepository.findOneBy({ userId });
  }

  async getUserProfileImage(userId: number): Promise<UserProfileImageEntity> {
    const result = await this.userProfileImageRepository.findOneBy({ userId });

    if (!result) {
      throw new ServiceError(
        'User profile image not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async deleteUserProfileImage(userId: number): Promise<void> {
    await this.userProfileImageRepository.delete({ userId });
  }

  async existUserByEmail(email: string): Promise<boolean> {
    const result = await this.userRepository.exists({ where: { email } });

    return result;
  }

  async existUserByPhone(phone: string): Promise<boolean> {
    const result = await this.userRepository.exists({ where: { phone } });

    return result;
  }

  async getUserByEmail(email: string): Promise<UserEntity> {
    const result = await this.userRepository.findOneBy({ email });

    if (!result) {
      throw new ServiceError('User not found', ServiceErrorCode.NOT_FOUND_DATA);
    }

    return result;
  }

  async getUserByPhone(phone: string): Promise<UserEntity> {
    const result = await this.userRepository.findOneBy({ phone });

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

  async validateUserName(name: string, excludeUserId?: number): Promise<void> {
    const where =
      excludeUserId !== undefined
        ? { name, userId: Not(excludeUserId) }
        : { name };
    const result = await this.userProfileRepository.findOneBy(where);

    if (result) {
      throw new ServiceError(
        'User name already exists',
        ServiceErrorCode.CONFLICT,
      );
    }
  }
}
