import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ShippingRemoteAreaEntity } from '@app/repository/entity/shipping-remote-area.entity';
import { ShippingRepositoryService } from '@app/repository/service/shipping.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetAdminShippingPolicyResponse,
  GetAdminShippingRemoteAreaResponse,
  PatchAdminShippingPolicyRequest,
  PostAdminShippingRemoteAreaRequest,
} from './admin.shipping.dto';

@Injectable()
export class AdminShippingService {
  constructor(
    private readonly shippingRepositoryService: ShippingRepositoryService,
  ) {}

  async getPolicy(): Promise<GetAdminShippingPolicyResponse> {
    const policy = await this.shippingRepositoryService.getPolicy();

    return GetAdminShippingPolicyResponse.from(policy);
  }

  async updatePolicy(dto: PatchAdminShippingPolicyRequest) {
    await this.shippingRepositoryService.updatePolicy(dto);
  }

  async getRemoteAreaList(): Promise<GetAdminShippingRemoteAreaResponse[]> {
    const areas = await this.shippingRepositoryService.findAllRemoteAreas();

    return areas.map((area) => GetAdminShippingRemoteAreaResponse.from(area));
  }

  async createRemoteArea(dto: PostAdminShippingRemoteAreaRequest) {
    const district = dto.district ?? null;

    const exist = await this.shippingRepositoryService.existRemoteArea(
      dto.city,
      district,
    );

    if (exist) {
      throw new ServiceError(
        `Already registered remote area: ${dto.city} ${district ?? '(all)'}`,
        ServiceErrorCode.CONFLICT,
      );
    }

    await this.shippingRepositoryService.createRemoteArea(
      plainToInstance(ShippingRemoteAreaEntity, {
        city: dto.city,
        district,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async deleteRemoteArea(id: number) {
    const area = await this.shippingRepositoryService.findRemoteAreaById(id);

    if (!area) {
      throw new ServiceError(
        `No exist remote area ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    await this.shippingRepositoryService.deleteRemoteArea(id);
  }
}
