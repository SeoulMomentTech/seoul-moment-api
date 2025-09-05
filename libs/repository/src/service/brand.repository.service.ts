import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BrandEntity } from '../entity/brand.entity';
import { BrandStatus, BrandNameFilter } from '../enum/brand.enum';
import { EntityType } from '../enum/entity.enum';

@Injectable()
export class BrandRepositoryService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandRepository: Repository<BrandEntity>,
  ) {}

  async findAllNormalBrandList(): Promise<BrandEntity[]> {
    return this.brandRepository.findBy({
      status: BrandStatus.NORMAL,
    });
  }

  async findBrandById(id: number): Promise<BrandEntity | null> {
    return this.brandRepository.findOneBy({
      id,
      status: BrandStatus.NORMAL,
    });
  }

  async getBrandById(id: number): Promise<BrandEntity> {
    const result = await this.brandRepository.findOneBy({
      id,
      status: BrandStatus.NORMAL,
    });

    if (!result) {
      throw new ServiceError(
        'Brand not found or not in normal status',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findAllNormalBrandListByFilter(
    type: BrandNameFilter,
    categoryId?: number,
  ): Promise<BrandEntity[]> {
    const query = this.brandRepository
      .createQueryBuilder('brand')
      .leftJoin(
        'multilingual_text',
        'mt',
        'mt.entity_type = :entityType AND mt.entity_id = brand.id AND mt.field_name = :fieldName AND mt.language_id = :languageId',
        {
          entityType: EntityType.BRAND,
          fieldName: 'name',
          languageId: 2, // 영어 ID
        },
      )
      .where('brand.status = :status', { status: BrandStatus.NORMAL });

    const firstLetterCondition = this.getFirstLetterCondition(type);
    query.andWhere(firstLetterCondition);

    if (categoryId) {
      query.andWhere('brand.categoryId = :categoryId', { categoryId });
    }

    return query.getMany();
  }

  private getFirstLetterCondition(type: BrandNameFilter): string {
    if (type === BrandNameFilter.NUMBER_SYMBOL) {
      return "NOT (UPPER(SUBSTRING(mt.text_content, 1, 1)) BETWEEN 'A' AND 'Z')";
    }

    // 'A_TO_D' -> ['A', 'TO', 'D'] -> startLetter: 'A', endLetter: 'D'
    const parts = type.split('_');
    const startLetter = parts[0];
    const endLetter = parts[2]; // parts[1]은 'TO'

    return `UPPER(SUBSTRING(mt.text_content, 1, 1)) BETWEEN '${startLetter}' AND '${endLetter}'`;
  }
}
