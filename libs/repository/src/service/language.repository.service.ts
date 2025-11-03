import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LanguageEntity } from '../entity/language.entity';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';
import { LanguageCode } from '../enum/language.enum';

@Injectable()
export class LanguageRepositoryService implements OnModuleInit {
  constructor(
    @InjectRepository(LanguageEntity)
    private readonly languageRepository: Repository<LanguageEntity>,
    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.languageRepository.count();
    if (count === 0) {
      await this.languageRepository.save([
        {
          code: LanguageCode.KOREAN,
          name: '한국어',
          englishName: 'Korean',
          isActive: true,
          sortOrder: 1,
        },
        {
          code: LanguageCode.ENGLISH,
          name: 'English',
          englishName: 'English',
          isActive: true,
          sortOrder: 2,
        },
        {
          code: LanguageCode.TAIWAN,
          name: '中文',
          englishName: 'Taiwan',
          isActive: true,
          sortOrder: 3,
        },
      ]);
    }
  }

  async findAllActiveLanguages(): Promise<LanguageEntity[]> {
    return this.languageRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findLanguageByCode(code: LanguageCode): Promise<LanguageEntity | null> {
    return this.languageRepository.findOne({
      where: { code, isActive: true },
    });
  }

  async findLanguageById(id: number): Promise<LanguageEntity | null> {
    return this.languageRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async findMultilingualTexts(
    entityType: string,
    entityId: number,
    languageCode?: LanguageCode,
  ): Promise<MultilingualTextEntity[]> {
    const queryBuilder = this.multilingualTextRepository
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.language', 'lang')
      .where('mt.entityType = :entityType', { entityType })
      .andWhere('mt.entityId = :entityId', { entityId })
      .andWhere('lang.isActive = true');

    if (languageCode) {
      queryBuilder.andWhere('lang.code = :languageCode', { languageCode });
    }

    return queryBuilder
      .orderBy('lang.sortOrder', 'ASC')
      .addOrderBy('mt.fieldName', 'ASC')
      .getMany();
  }

  async findMultilingualTextsByEntities(
    entityType: string,
    entityIds: number[],
    languageCode?: LanguageCode,
  ): Promise<MultilingualTextEntity[]> {
    if (entityIds.length === 0) {
      return [];
    }

    const queryBuilder = this.multilingualTextRepository
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.language', 'lang')
      .where('mt.entityType = :entityType', { entityType })
      .andWhere('mt.entityId IN (:...entityIds)', { entityIds })
      .andWhere('lang.isActive = true');

    if (languageCode) {
      queryBuilder.andWhere('lang.code = :languageCode', { languageCode });
    }

    return queryBuilder
      .orderBy('mt.entityId', 'ASC')
      .addOrderBy('lang.sortOrder', 'ASC')
      .addOrderBy('mt.fieldName', 'ASC')
      .getMany();
  }

  async saveMultilingualText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    languageId: number,
    textContent: string,
  ): Promise<MultilingualTextEntity> {
    const existingText = await this.multilingualTextRepository.findOne({
      where: {
        entityType,
        entityId,
        fieldName,
        languageId,
      },
    });

    if (existingText) {
      existingText.textContent = textContent;
      return this.multilingualTextRepository.save(existingText);
    }

    const newText = this.multilingualTextRepository.create({
      entityType,
      entityId,
      fieldName,
      languageId,
      textContent,
    });

    return this.multilingualTextRepository.save(newText);
  }

  async deleteMultilingualTexts(
    entityType: EntityType,
    entityId: number,
  ): Promise<void> {
    await this.multilingualTextRepository.delete({
      entityType,
      entityId,
    });
  }
}
