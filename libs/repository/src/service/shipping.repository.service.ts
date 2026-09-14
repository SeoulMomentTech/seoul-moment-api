import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ShippingPolicyEntity } from '../entity/shipping-policy.entity';
import { ShippingRemoteAreaEntity } from '../entity/shipping-remote-area.entity';

/** 정책은 단일 행이다. 행이 비어 있으면 기본값으로 만들어 준다. */
const POLICY_ID = 1;

@Injectable()
export class ShippingRepositoryService {
  constructor(
    @InjectRepository(ShippingPolicyEntity)
    private readonly shippingPolicyRepository: Repository<ShippingPolicyEntity>,
    @InjectRepository(ShippingRemoteAreaEntity)
    private readonly shippingRemoteAreaRepository: Repository<ShippingRemoteAreaEntity>,
  ) {}

  /**
   * 정책 행이 없으면 기본값으로 생성한다. synchronize 로 테이블만 생기고
   * 데이터는 안 들어오므로, 조회 시점에 보장하는 편이 seed 스크립트보다 안전하다.
   */
  async getPolicy(): Promise<ShippingPolicyEntity> {
    const policy = await this.shippingPolicyRepository.findOne({
      where: { id: POLICY_ID },
    });

    if (policy) {
      return policy;
    }

    // 컬럼 default 가 아니라 여기서 명시한다. 운영 초기값(외섬 프로모션 진행 중)이
    // 어디에 적혀 있는지 한 곳에서 읽히게 하기 위해서다.
    return this.shippingPolicyRepository.save(
      this.shippingPolicyRepository.create({
        id: POLICY_ID,
        baseFee: 60,
        remoteIslandFee: 100,
        remoteIslandPromotion: true,
        freeShippingThreshold: 1150,
      }),
    );
  }

  async updatePolicy(
    dto: Partial<
      Pick<
        ShippingPolicyEntity,
        | 'baseFee'
        | 'remoteIslandFee'
        | 'remoteIslandPromotion'
        | 'freeShippingThreshold'
      >
    >,
  ): Promise<ShippingPolicyEntity> {
    const policy = await this.getPolicy();

    Object.assign(policy, dto);

    return this.shippingPolicyRepository.save(policy);
  }

  async findActiveRemoteAreas(): Promise<ShippingRemoteAreaEntity[]> {
    return this.shippingRemoteAreaRepository.find({
      where: { isActive: true },
      order: { city: 'ASC', district: 'ASC' },
    });
  }

  async findAllRemoteAreas(): Promise<ShippingRemoteAreaEntity[]> {
    return this.shippingRemoteAreaRepository.find({
      order: { city: 'ASC', district: 'ASC' },
    });
  }

  async existRemoteArea(
    city: string,
    district: string | null,
  ): Promise<boolean> {
    return this.shippingRemoteAreaRepository.exists({
      where: { city, district: district === null ? IsNull() : district },
    });
  }

  async createRemoteArea(
    entity: ShippingRemoteAreaEntity,
  ): Promise<ShippingRemoteAreaEntity> {
    return this.shippingRemoteAreaRepository.save(entity);
  }

  async deleteRemoteArea(id: number) {
    return this.shippingRemoteAreaRepository.delete(id);
  }

  async findRemoteAreaById(
    id: number,
  ): Promise<ShippingRemoteAreaEntity | null> {
    return this.shippingRemoteAreaRepository.findOne({ where: { id } });
  }
}
