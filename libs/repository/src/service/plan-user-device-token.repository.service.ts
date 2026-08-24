import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { In, Repository } from 'typeorm';

import { PlanUserDeviceTokenEntity } from '../entity/plan-user-device-token.entity';
import { DevicePlatform } from '../enum/plan-user-device-token.enum';

@Injectable()
export class PlanUserDeviceTokenRepositoryService {
  constructor(
    @InjectRepository(PlanUserDeviceTokenEntity)
    private readonly planUserDeviceTokenRepository: Repository<PlanUserDeviceTokenEntity>,
  ) {}

  /**
   * 토큰 기준 upsert. 같은 토큰이 다시 오면 소유자·플랫폼만 갱신한다
   * (기기를 다른 계정으로 재로그인한 경우 이전 계정 알림이 새지 않도록).
   */
  async upsert(
    planUserId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<PlanUserDeviceTokenEntity> {
    // token 에 unique 가 걸려 있어, 소프트 삭제된 행도 찾아야 INSERT 충돌을 피할 수 있다.
    const existing = await this.planUserDeviceTokenRepository.findOne({
      where: { token },
      withDeleted: true,
    });

    if (existing) {
      existing.planUserId = planUserId;
      existing.platform = platform;
      existing.deleteDate = null;

      return this.planUserDeviceTokenRepository.save(existing);
    }

    return this.planUserDeviceTokenRepository.save(
      plainToInstance(PlanUserDeviceTokenEntity, {
        planUserId,
        token,
        platform,
      }),
    );
  }

  async findTokensByPlanUserIds(planUserIds: string[]): Promise<string[]> {
    if (planUserIds.length === 0) {
      return [];
    }

    const entities = await this.planUserDeviceTokenRepository.find({
      where: { planUserId: In(planUserIds) },
      select: ['token'],
    });

    return entities.map((entity) => entity.token);
  }

  /**
   * 로그아웃한 기기의 토큰 하나만 지운다.
   *
   * 소유자까지 조건에 넣는 이유: 토큰 값만으로 지울 수 있게 두면, 남의 토큰을 아는 사람이
   * 그 기기의 알림을 끊을 수 있다. 다른 기기의 토큰은 남으므로 나머지 기기는 계속 받는다.
   */
  async deleteByPlanUserIdAndToken(
    planUserId: string,
    token: string,
  ): Promise<void> {
    await this.planUserDeviceTokenRepository.delete({ planUserId, token });
  }

  /**
   * 탈퇴한 사용자의 기기 토큰 전부. 남겨 두면 계정이 사라진 뒤에도 그 기기로
   * 푸시가 계속 간다.
   */
  async deleteAllByPlanUserId(planUserId: string): Promise<void> {
    await this.planUserDeviceTokenRepository.delete({ planUserId });
  }

  /** FCM 이 더 이상 유효하지 않다고 답한 토큰 정리. 복구 대상이 아니라 hard delete 한다. */
  async deleteByTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    await this.planUserDeviceTokenRepository.delete({ token: In(tokens) });
  }
}
