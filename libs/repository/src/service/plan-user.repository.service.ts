import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanUserEntity } from '../entity/plan-user.entity';
import { PlanUserStatus, PlatformType } from '../enum/plan-user.enum';

@Injectable()
export class PlanUserRepositoryService {
  constructor(
    @InjectRepository(PlanUserEntity)
    private readonly planUserRepository: Repository<PlanUserEntity>,
  ) {}

  async create(planUser: PlanUserEntity): Promise<PlanUserEntity> {
    return this.planUserRepository.save(planUser);
  }

  async findByPlatfomeType(
    platformType: PlatformType,
    id: number,
    email?: string,
  ): Promise<PlanUserEntity | null> {
    switch (platformType) {
      case PlatformType.KAKAO:
        return this.planUserRepository.findOneBy({
          kakaoId: id,
          kakaoEmail: email,
        });
      case PlatformType.NAVER:
        return this.planUserRepository.findOneBy({
          naverId: id,
          naverEmail: email,
        });
      case PlatformType.GOOGLE:
        return this.planUserRepository.findOneBy({
          googleId: id,
          googleEmail: email,
        });
    }
  }

  async getByKakaoInfo(kakaoId: number, id: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ kakaoId, id });

    if (!result) {
      throw new ServiceError(
        'Plan user not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findByKakaoInfo(
    kakaoId: number,
    id: string,
  ): Promise<PlanUserEntity | null> {
    return this.planUserRepository.findOne({
      where: { kakaoId, id },
      relations: ['room'],
    });
  }

  async getById(id: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        'Plan user not found id: ${id}',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async getByRoomShareCode(roomShareCode: string): Promise<PlanUserEntity> {
    const result = await this.planUserRepository.findOneBy({ roomShareCode });

    if (!result) {
      throw new ServiceError(
        `Plan user not found roomShareCode: ${roomShareCode}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return result;
  }

  async update(planUser: PlanUserEntity): Promise<PlanUserEntity> {
    return this.planUserRepository.save(planUser);
  }

  /**
   * 회원 탈퇴. 개인을 가리키는 값만 즉시 비우고 행 자체는 소프트 삭제로 남긴다.
   *
   * 소셜 id 를 비우는 이유가 두 가지다. 개인정보 파기 의무가 하나고, 같은
   * 카카오 계정으로 다시 들어왔을 때 `findByPlatfomeType` 이 이 행을 못 찾아
   * 새 사용자로 시작하는 게 나머지 하나다 — 탈퇴한 사람의 옛 일정이 재가입
   * 직후에 되살아나면 안 된다.
   *
   * 채팅 메시지와 견적 후기는 지우지 않는다. 대화는 방에 남은 배우자의
   * 것이기도 하고, 후기는 애초에 작성자를 내려보내지 않는 익명 데이터다.
   * 이 행이 익명화되면 둘 다 더는 사람을 가리키지 않는다.
   *
   * `roomShareCode` 는 nullable 이 아니라 그대로 둔다. UUID 라 사람을
   * 가리키지 않고, 비우려면 스키마를 바꿔야 한다.
   */
  async withdraw(id: string): Promise<void> {
    const planUser = await this.getById(id);

    planUser.kakaoId = null;
    planUser.kakaoEmail = null;
    planUser.naverId = null;
    planUser.naverEmail = null;
    planUser.googleId = null;
    planUser.googleEmail = null;
    planUser.name = null;
    planUser.profileImageUrl = null;
    planUser.weddingVenue = null;
    planUser.status = PlanUserStatus.DELETE;

    await this.planUserRepository.save(planUser);

    // save 뒤에 지운다. 순서를 바꾸면 소프트 삭제된 행을 save 가 다시
    // 살려 낸다(`deleteDate` 를 건드리지 않고 그대로 쓰기 때문).
    await this.planUserRepository.softDelete({ id });
  }
}
