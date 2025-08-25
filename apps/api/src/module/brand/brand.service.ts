import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { Injectable } from '@nestjs/common';
import { GetBrandIntroduceResponse } from './brand.dto';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepositoryService: BrandRepositoryService,
  ) {}

  async getBrandIntroduce(id: number): Promise<GetBrandIntroduceResponse> {
    const brandEntity = await this.brandRepositoryService.getBrandById(id);

    return GetBrandIntroduceResponse.from(brandEntity);
  }
}
