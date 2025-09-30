import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OptionValueEntity } from '../entity/option-value.entity';
import { OptionEntity } from '../entity/option.entity';
import { VariantOptionEntity } from '../entity/variant-option.entity';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class OptionRepositoryService {
  constructor(
    @InjectRepository(OptionEntity)
    private readonly optionRepository: Repository<OptionEntity>,
    @InjectRepository(OptionValueEntity)
    private readonly optionValueRepository: Repository<OptionValueEntity>,
    @InjectRepository(VariantOptionEntity)
    private readonly variantOptionRepository: Repository<VariantOptionEntity>,
    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  async getOption(): Promise<OptionEntity[]> {
    return this.optionRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });
  }

  async getOptionValueByOptionId(
    optionId: number,
  ): Promise<OptionValueEntity[]> {
    return this.optionValueRepository.find({
      where: {
        option: {
          id: optionId,
        },
      },
      order: {
        sortOrder: 'ASC',
      },
    });
  }
}
