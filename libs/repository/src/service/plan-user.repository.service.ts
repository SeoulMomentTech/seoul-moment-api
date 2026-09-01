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

  /**
   * 인증용 조회. 없으면 예외 대신 null 을 준다.
   *
   * `getById` 를 쓰면 탈퇴/오래된 토큰이 404 로 나가는데, 그건 "요청한 자원이
   * 없다" 는 뜻이라 프론트가 세션 만료로 알아채지 못한다. 가드가 401 로
   * 바꿔 던지도록 판단을 넘긴다.
   *
   * 소프트 삭제된 행은 TypeORM 이 기본으로 제외하므로 탈퇴한 사용자의 토큰은
   * 여기서 이미 걸린다.
   */
  async findById(id: string): Promise<PlanUserEntity | null> {
    return this.planUserRepository.findOneBy({ id });
  }

  /**
   * 토큰 세대를 1 올려 이미 발급된 JWT 를 전부 무효로 만든다.
   *
   * 엔티티를 읽어 save 하지 않고 원자적 증가로 쓴다 — 여러 요청이 겹쳐도
   * 세대가 뒤로 밀리지 않아야 한다(회수는 늦어지면 의미가 없다).
   */
  async incrementTokenVersion(id: string): Promise<void> {
    await this.planUserRepository.increment({ id }, 'tokenVersion', 1);
  }

  /**
   * 마지막 접속 일시만 갱신한다.
   *
   * 가드가 매 요청 부르던 자리라 엔티티 전체를 save 하지 않는다 — 그 방식은
   * 모든 컬럼을 쓰는 UPDATE 라, 같은 사용자의 요청이 겹치면 오래된 스냅샷이
   * 방금 저장한 값을 덮어쓸 수 있었다.
   */
  async touchLastLoginDate(id: string, at: Date): Promise<void> {
    await this.planUserRepository.update({ id }, { lastLoginDate: at });
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
    // 나가 있는 토큰을 함께 끊는다. 소프트 삭제만으로도 가드의 조회가
    // 실패하지만, 되살리는 일이 생기더라도 옛 토큰이 살아 돌아오면 안 된다.
    planUser.tokenVersion = (planUser.tokenVersion ?? 0) + 1;

    await this.planUserRepository.save(planUser);

    // save 뒤에 지운다. 순서를 바꾸면 소프트 삭제된 행을 save 가 다시
    // 살려 낸다(`deleteDate` 를 건드리지 않고 그대로 쓰기 때문).
    await this.planUserRepository.softDelete({ id });
  }
}
