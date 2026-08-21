import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { LookbookCommentEntity } from '../entity/lookbook-comment.entity';
import { LookbookEntity } from '../entity/lookbook.entity';
import { UserBrandLikeEntity } from '../entity/user-brand-like.entity';
import { UserFitEntity } from '../entity/user-fit.entity';
import { UserLookbookLikeEntity } from '../entity/user-lookbook-like.entity';
import { UserProductLikeEntity } from '../entity/user-product-like.entity';
import { UserProfileImageEntity } from '../entity/user-profile-image.entity';
import { UserProfileEntity } from '../entity/user-profile.entity';
import { UserSnsEntity } from '../entity/user-sns.entity';
import { UserEntity } from '../entity/user.entity';
import { UserRecentEntity } from '../entity/user.recent.entity';

/**
 * 탈퇴 회원 이메일에 사용하는 도메인. `.invalid` 는 RFC 2606 예약 TLD라
 * 실제로 발송/수신될 수 없다.
 */
const WITHDRAWN_EMAIL_DOMAIN = 'withdrawn.invalid';

/** 익명값 뒤에 붙는 랜덤 토큰 길이. 재가입 계정과의 unique 충돌을 막는다. */
const ANONYMIZED_TOKEN_LENGTH = 8;

@Injectable()
export class UserWithdrawRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(UserProfileEntity)
    private readonly userProfileRepository: Repository<UserProfileEntity>,

    @InjectRepository(UserProfileImageEntity)
    private readonly userProfileImageRepository: Repository<UserProfileImageEntity>,

    @InjectRepository(UserFitEntity)
    private readonly userFitRepository: Repository<UserFitEntity>,

    @InjectRepository(UserSnsEntity)
    private readonly userSnsRepository: Repository<UserSnsEntity>,

    @InjectRepository(UserBrandLikeEntity)
    private readonly userBrandLikeRepository: Repository<UserBrandLikeEntity>,

    @InjectRepository(UserProductLikeEntity)
    private readonly userProductLikeRepository: Repository<UserProductLikeEntity>,

    @InjectRepository(UserLookbookLikeEntity)
    private readonly userLookbookLikeRepository: Repository<UserLookbookLikeEntity>,

    @InjectRepository(UserRecentEntity)
    private readonly userRecentRepository: Repository<UserRecentEntity>,

    @InjectRepository(LookbookEntity)
    private readonly lookbookRepository: Repository<LookbookEntity>,

    @InjectRepository(LookbookCommentEntity)
    private readonly lookbookCommentRepository: Repository<LookbookCommentEntity>,
  ) {}

  /**
   * 회원을 탈퇴 처리한다. 호출자가 트랜잭션을 열어 줘야 한다.
   *
   * 1. 재가입 시 되살아나면 안 되는 부속 데이터(연동/좋아요/최근본)는 물리 삭제
   * 2. 프로필·체형·룩북은 개인정보를 지운 뒤 소프트 삭제
   * 3. user 행은 식별정보를 익명값으로 치환하고 소프트 삭제
   *
   * @returns S3에서 지워야 할 프로필 이미지 경로 (없으면 null)
   */
  async withdrawUser(userId: number): Promise<string | null> {
    const imagePath = await this.removeUserRelations(userId);

    await this.anonymizeUserProfile(userId);
    await this.anonymizeUser(userId);

    return imagePath;
  }

  /**
   * 유저에 종속된 부속 데이터를 정리한다.
   * 좋아요/최근본/SNS 연동은 복구 대상이 아니고 unique 제약(user_sns의
   * provider+providerUserId)이 재가입을 막으므로 물리 삭제한다.
   */
  private async removeUserRelations(userId: number): Promise<string | null> {
    const image = await this.userProfileImageRepository.findOneBy({ userId });

    await this.userProfileImageRepository.delete({ userId });
    await this.userSnsRepository.delete({ userId });
    await this.userBrandLikeRepository.delete({ userId });
    await this.userProductLikeRepository.delete({ userId });
    await this.userLookbookLikeRepository.delete({ userId });
    await this.userRecentRepository.delete({ userId });

    await this.userFitRepository.softDelete({ userId });
    await this.lookbookCommentRepository.softDelete({ userId });
    await this.lookbookRepository.softDelete({ user_id: userId });

    return image?.imagePath ?? null;
  }

  /** 프로필의 개인정보 컬럼을 비우고 소프트 삭제한다. */
  private async anonymizeUserProfile(userId: number): Promise<void> {
    const exists = await this.userProfileRepository.exists({
      where: { userId },
    });

    if (!exists) return;

    await this.userProfileRepository.update(userId, {
      name: null,
      gender: null,
      birthDate: null,
      postalCode: null,
      city: null,
      district: null,
      detailAddress: null,
    });

    await this.userProfileRepository.softDelete(userId);
  }

  /**
   * user 행의 식별정보를 익명값으로 치환하고 소프트 삭제한다.
   *
   * email/nickname/phone 에는 unique 제약이 걸려 있고 소프트 삭제된 행도
   * 인덱스에 남는다. 익명화하지 않으면 같은 이메일·번호로 재가입할 수 없다.
   */
  private async anonymizeUser(userId: number): Promise<void> {
    const token = randomUUID().slice(0, ANONYMIZED_TOKEN_LENGTH);

    await this.userRepository.update(userId, {
      email: `withdrawn-${userId}-${token}@${WITHDRAWN_EMAIL_DOMAIN}`,
      nickname: `탈퇴회원-${userId}-${token}`,
      phone: null,
      // bcrypt.compare 는 해시가 아닌 값에 대해 항상 false 를 돌려주므로
      // 빈 문자열이면 어떤 비밀번호로도 로그인할 수 없다.
      password: '',
      refreshToken: null,
      newProductDate: null,
      adAgreeDate: null,
      recommendDate: null,
    });

    await this.userRepository.softDelete(userId);
  }
}
