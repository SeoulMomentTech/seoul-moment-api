import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
  ) {}
}
