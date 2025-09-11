import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PartnerEntity } from '../entity/partner.entity';
import { LanguageCode } from '../enum/language.enum';

@Injectable()
export class PartnerRepositoryService {
  constructor(
    @InjectRepository(PartnerEntity)
    private readonly partnerRepository: Repository<PartnerEntity>,
  ) {}

  async find(): Promise<PartnerEntity[]> {
    return this.partnerRepository.find();
  }

  async findByCategoryIdAndCountry(
    partnerCategoryId: number,
    country: LanguageCode,
  ): Promise<PartnerEntity[]> {
    return this.partnerRepository.findBy({
      partnerCategoryId,
      country,
    });
  }
}
