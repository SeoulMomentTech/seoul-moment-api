import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';

import { OptionSortDto, UpdateOptionDto } from '../dto/option.dto';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { OptionValueEntity } from '../entity/option-value.entity';
import { OptionEntity } from '../entity/option.entity';
import { VariantOptionEntity } from '../entity/variant-option.entity';
import { EntityType } from '../enum/entity.enum';
import { OptionSortColumn } from '../enum/option.repository.enum';
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

    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,

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

  async findOptionByFilter(
    pageDto: PagingDto,
    sortDto: OptionSortDto = OptionSortDto.from(
      OptionSortColumn.CREATE,
      DatabaseSort.DESC,
    ),
    search?: string,
  ): Promise<[OptionEntity[], number]> {
    let optionIds: number[] = [];

    if (search) {
      const multilingualTexts = await this.multilingualTextRepository.find({
        where: {
          entityType: EntityType.OPTION,
          fieldName: 'name',
          textContent: Like(`%${search}%`),
        },
      });

      optionIds = multilingualTexts.map((text) => text.entityId);
    }

    const [optionEntities, total] = await this.optionRepository.findAndCount({
      where: {
        id: search ? In(optionIds) : undefined,
      },
      order: {
        createDate: sortDto.sort,
      },
      skip: (pageDto.page - 1) * pageDto.count,
      take: pageDto.count,
    });

    return [optionEntities, total];
  }

  async deleteOption(id: number) {
    return this.optionRepository.delete(id);
  }

  async updateOption(dto: UpdateOptionDto) {
    return this.optionRepository.save(dto);
  }

  async getOptionById(id: number): Promise<OptionEntity> {
    const result = await this.optionRepository.findOneBy({ id });

    if (!result)
      throw new ServiceError(
        `No exist option ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );

    return result;
  }
}
