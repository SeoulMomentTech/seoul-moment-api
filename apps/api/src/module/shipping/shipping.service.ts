import { ShippingRepositoryService } from '@app/repository/service/shipping.repository.service';
import { Injectable } from '@nestjs/common';

import { GetShippingPolicyResponse } from './shipping.dto';

@Injectable()
export class ShippingService {
  constructor(
    private readonly shippingRepositoryService: ShippingRepositoryService,
  ) {}

  async getPolicy(): Promise<GetShippingPolicyResponse> {
    const policy = await this.shippingRepositoryService.getPolicy();

    return GetShippingPolicyResponse.from(policy);
  }
}
