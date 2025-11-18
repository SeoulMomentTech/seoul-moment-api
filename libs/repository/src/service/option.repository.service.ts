import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
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

  async insertOption(entity: OptionEntity): Promise<OptionEntity> {
    await this.sortOrderHelper.setNextSortOrder(entity, this.optionRepository);

    return this.optionRepository.save(entity);
  }

  async insertOptionValue(
    entity: OptionValueEntity,
  ): Promise<OptionValueEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.optionValueRepository,
    );

    return this.optionValueRepository.save(entity);
  }

  async bulkInsertVariantOption(
    entity: VariantOptionEntity[],
  ): Promise<VariantOptionEntity[]> {
    return this.variantOptionRepository.save(entity);
  }

  async getOptionValueByOptionValueId(
    optionValueId: number,
  ): Promise<OptionValueEntity> {
    const result = await this.optionValueRepository.findOneBy({
      id: optionValueId,
    });

    if (!result)
      throw new ServiceError(
        `No exist option value ID: ${optionValueId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }
}
