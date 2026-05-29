import { LoggerService } from '@app/common/log/logger.service';
import { stripImageDomain } from '@app/common/util/image.util';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { UpdateUserDto } from '@app/repository/dto/user.dto';
import { UserFitEntity } from '@app/repository/entity/user-fit.entity';
import { UserProfileImageEntity } from '@app/repository/entity/user-profile-image.entity';
import { UserProfileEntity } from '@app/repository/entity/user-profile.entity';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetUserFitResponse,
  GetUserInfoResponse,
  GetUserProfileResponse,
  PatchUserFitRequest,
  PatchUserInfoRequest,
  PatchUserProfileNameRequest,
  PatchUserProfileNicknameRequest,
  PatchUserProfileRequest,
  PostUserFitRequest,
  PostUserProfileImageRequest,
  PostUserProfileRequest,
} from './user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepositoryService: UserRepositoryService,
    private readonly s3Service: S3Service,
    private readonly logger: LoggerService,
  ) {}

  async getUserInfo(id: number): Promise<GetUserInfoResponse> {
    const user = await this.userRepositoryService.getUserInfo(id);

    return GetUserInfoResponse.from(user);
  }

  async patchUserInfo(id: number, dto: PatchUserInfoRequest): Promise<void> {
    const user = await this.userRepositoryService.getUserById(id);

    const updateDto: UpdateUserDto = {
      id: user.id,
      newProductDate: dto.newProductAgreed ? new Date() : null,
      adAgreeDate: dto.adAgreed ? new Date() : null,
      recommendDate: dto.recommendAgreed ? new Date() : null,
    };

    await this.userRepositoryService.updateUser(updateDto);
  }

  @Transactional()
  async postUserProfile(
    id: number,
    dto: PostUserProfileRequest,
  ): Promise<void> {
    await this.validateAndUpdateNickname(id, dto.nickname);

    await this.userRepositoryService.createUserProfile(
      plainToInstance(UserProfileEntity, {
        userId: id,
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate,
        postalCode: dto.postalCode,
        city: dto.city,
        district: dto.district,
        detailAddress: dto.detailAddress,
      }),
    );
  }

  @Transactional()
  async patchUserProfile(
    id: number,
    dto: PatchUserProfileRequest,
  ): Promise<void> {
    await this.userRepositoryService.getUserProfile(id);

    await this.userRepositoryService.updateUserProfile({
      userId: id,
      gender: dto.gender,
      birthDate: dto.birthDate,
      postalCode: dto.postalCode,
      city: dto.city,
      district: dto.district,
      detailAddress: dto.detailAddress,
    });
  }

  async getUserProfile(id: number): Promise<GetUserProfileResponse> {
    const user = await this.userRepositoryService.getUserById(id);
    const userProfile = await this.userRepositoryService.findUserProfile(id);

    return GetUserProfileResponse.from(userProfile, user.nickname);
  }

  async postUserProfileImage(
    id: number,
    dto: PostUserProfileImageRequest,
  ): Promise<void> {
    const previousImagePath = await this.replaceUserProfileImage(id, dto);

    if (previousImagePath) {
      await this.removeS3Image(previousImagePath);
    }
  }

  @Transactional()
  private async replaceUserProfileImage(
    id: number,
    dto: PostUserProfileImageRequest,
  ): Promise<string | null> {
    const existing = await this.userRepositoryService.findUserProfileImage(id);

    if (existing) {
      await this.userRepositoryService.deleteUserProfileImage(id);
    }

    await this.userRepositoryService.createUserProfileImage(
      plainToInstance(UserProfileImageEntity, {
        userId: id,
        imagePath: stripImageDomain(dto.imageUrl),
      }),
    );

    return existing?.imagePath ?? null;
  }

  async deleteUserProfileImage(id: number): Promise<void> {
    const image = await this.userRepositoryService.getUserProfileImage(id);

    await this.userRepositoryService.deleteUserProfileImage(id);
    await this.removeS3Image(image.imagePath);
  }

  private async removeS3Image(imagePath: string): Promise<void> {
    if (!imagePath) return;

    const key = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

    try {
      await this.s3Service.deleteFile(key);
    } catch (error) {
      this.logger.warn('Failed to delete S3 object during profile image flow', {
        key,
        error: error.message,
      });
    }
  }

  @Transactional()
  async postUserFit(id: number, dto: PostUserFitRequest): Promise<void> {
    await this.userRepositoryService.createUserFit(
      plainToInstance(UserFitEntity, {
        userId: id,
        height: dto.height,
        weight: dto.weight,
        shoeSize: dto.shoeSize,
        outerSize: dto.outerSize,
        topSize: dto.topSize,
        bottomSize: dto.bottomSize,
      }),
    );
  }

  async patchUserFit(id: number, dto: PatchUserFitRequest): Promise<void> {
    await this.userRepositoryService.getUserFit(id);

    await this.userRepositoryService.updateUserFit({
      userId: id,
      height: dto.height,
      weight: dto.weight,
      shoeSize: dto.shoeSize,
      outerSize: dto.outerSize,
      topSize: dto.topSize,
      bottomSize: dto.bottomSize,
    });
  }

  async getUserFit(id: number): Promise<GetUserFitResponse> {
    const userFit = await this.userRepositoryService.getUserFit(id);

    return GetUserFitResponse.from(userFit);
  }

  async deleteUserFit(id: number): Promise<void> {
    await this.userRepositoryService.getUserFit(id);

    await this.userRepositoryService.softDeleteUserFit(id);
  }

  async patchUserProfileNickname(
    id: number,
    dto: PatchUserProfileNicknameRequest,
  ): Promise<void> {
    await this.userRepositoryService.getUserProfile(id);

    await this.validateAndUpdateNickname(id, dto.nickname);
  }

  async patchUserProfileName(
    id: number,
    dto: PatchUserProfileNameRequest,
  ): Promise<void> {
    await this.userRepositoryService.getUserProfile(id);

    await this.validateAndUpdateName(id, dto.name);
  }

  private async validateAndUpdateNickname(
    id: number,
    nickname: string,
  ): Promise<void> {
    await this.userRepositoryService.validateUserNickname(nickname, id);

    await this.userRepositoryService.updateUser({
      id,
      nickname,
    });
  }

  private async validateAndUpdateName(id: number, name: string): Promise<void> {
    await this.userRepositoryService.validateUserName(name, id);

    await this.userRepositoryService.updateUserProfile({
      userId: id,
      name,
    });
  }
}
