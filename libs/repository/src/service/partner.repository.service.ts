import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PartnerEntity } from '../entity/partner.entity';

@Injectable()
export class PartnerRepositoryService {
  constructor(
    @InjectRepository(PartnerEntity)
    private readonly partnerRepository: Repository<PartnerEntity>,
  ) {}

  async find(): Promise<PartnerEntity[]> {
    return this.partnerRepository.find();
  }

  async findByCategoryId(categoryId): Promise<PartnerEntity[]> {
    return this.partnerRepository.findBy({
      categoryId,
    });
  }
}
