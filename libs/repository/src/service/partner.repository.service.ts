import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PartnerCategoryEntity } from '../entity/partner-category.entity';
import { PartnerEntity } from '../entity/partner.entity';
import { LanguageCode } from '../enum/language.enum';

@Injectable()
export class PartnerRepositoryService {
  constructor(
    @InjectRepository(PartnerEntity)
    private readonly partnerRepository: Repository<PartnerEntity>,

    @InjectRepository(PartnerCategoryEntity)
    private readonly partnerCategoryRepository: Repository<PartnerCategoryEntity>,
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

  async findCategoryAll(): Promise<PartnerCategoryEntity[]> {
    return this.partnerCategoryRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });
  }
}
