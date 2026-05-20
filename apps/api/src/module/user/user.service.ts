import { stripImageDomain } from '@app/common/util/image.util';
import { UpdateUserDto } from '@app/repository/dto/user.dto';
import { UserFitEntity } from '@app/repository/entity/user-fit.entity';
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
  PatchUserProfileRequest,
  PostUserFitRequest,
  PostUserProfileRequest,
} from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepositoryService: UserRepositoryService) {}

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
        imagePath: dto.profileImageUrl
          ? stripImageDomain(dto.profileImageUrl)
          : undefined,
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

    await this.validateAndUpdateNickname(id, dto.nickname);

    await this.userRepositoryService.updateUserProfile({
      userId: id,
      imagePath: dto.profileImageUrl
        ? stripImageDomain(dto.profileImageUrl)
        : undefined,
      name: dto.name,
      gender: dto.gender,
      birthDate: dto.birthDate,
      postalCode: dto.postalCode,
      city: dto.city,
      district: dto.district,
      detailAddress: dto.detailAddress,
    });
  }

  async getUserProfile(id: number): Promise<GetUserProfileResponse> {
    const userProfile = await this.userRepositoryService.getUserProfile(id);

    return GetUserProfileResponse.from(userProfile);
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
}
