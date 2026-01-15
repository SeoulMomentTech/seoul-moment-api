import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  UpdateAdminBrandImage,
  UpdateAdminBrandSectionImageSortOrder,
  UpdateAdminBrandSectionSortOrder,
} from 'apps/api/src/module/admin/brand/admin.brand.dto';
import { In, Like, Repository } from 'typeorm';

import { UpdateBrandDto } from '../dto/brand.dto';
import { BrandBannerImageEntity } from '../entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '../entity/brand-section-image.entity';
import { BrandSectionEntity } from '../entity/brand-section.entity';
import { BrandEntity } from '../entity/brand.entity';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { BrandStatus, BrandNameFilter } from '../enum/brand.enum';
import { BrandSearchEnum } from '../enum/brand.repository.enum';
import { EntityType } from '../enum/entity.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class BrandRepositoryService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandRepository: Repository<BrandEntity>,

    @InjectRepository(BrandBannerImageEntity)
    private readonly brandBannerImageRepository: Repository<BrandBannerImageEntity>,

    @InjectRepository(BrandSectionEntity)
    private readonly brandSectionRepository: Repository<BrandSectionEntity>,

    @InjectRepository(BrandSectionImageEntity)
    private readonly brandSectionImageRepository: Repository<BrandSectionImageEntity>,

    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
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
        'mt.entityType = :entityType AND mt.entity_id = brand.id AND mt.field_name = :fieldName AND mt.language_id = :languageId',
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

  async insert(entity: BrandEntity): Promise<BrandEntity> {
    return await this.brandRepository.save(entity);
  }

  async insertSection(entity: BrandSectionEntity): Promise<BrandSectionEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.brandSectionRepository,
    );

    return await this.brandSectionRepository.save(entity);
  }

  async insertSectionImage(
    entity: BrandSectionImageEntity,
  ): Promise<BrandSectionImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.brandSectionImageRepository,
    );

    return await this.brandSectionImageRepository.save(entity);
  }

  async bulkInsertInitSectionImage(
    entites: BrandSectionImageEntity[],
  ): Promise<BrandSectionImageEntity[]> {
    return this.brandSectionImageRepository.save(entites);
  }

  async bulkInsertInitBannerImage(
    entites: BrandBannerImageEntity[],
  ): Promise<BrandBannerImageEntity[]> {
    return this.brandBannerImageRepository.save(entites);
  }

  async insertBannerImage(
    entity: BrandBannerImageEntity,
  ): Promise<BrandBannerImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.brandBannerImageRepository,
    );

    return await this.brandBannerImageRepository.save(entity);
  }

  private getFirstLetterCondition(type: BrandNameFilter): string {
    // 'A_TO_D' -> ['A', 'TO', 'D'] -> startLetter: 'A', endLetter: 'D'
    const parts = type.split('_');
    const startLetter = parts[0];
    const endLetter = parts[2]; // parts[1]은 'TO'

    return `UPPER(SUBSTRING(mt.text_content, 1, 1)) BETWEEN '${startLetter}' AND '${endLetter}'`;
  }

  async findBrandByFilter(
    page: number,
    count: number,
    searchName?: string,
    searchColumn?: BrandSearchEnum,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[BrandEntity[], number]> {
    let brandIds: number[] = [];

    if (searchName) {
      const multilingualTexts = await this.multilingualTextRepository.find({
        where: {
          entityType: EntityType.BRAND,
          fieldName: searchColumn,
          textContent: Like(`%${searchName}%`),
        },
      });

      brandIds = multilingualTexts.map((text) => text.entityId);
    }

    const [brandEntities, total] = await this.brandRepository.findAndCount({
      where: {
        id: searchName ? In(brandIds) : undefined,
      },
      order: {
        createDate: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });

    return [brandEntities, total];
  }

  async update(entity: UpdateBrandDto): Promise<BrandEntity> {
    return this.brandRepository.save(entity);
  }

  async updateBannerImage(dto: UpdateAdminBrandImage) {
    await this.brandBannerImageRepository.update(
      { imageUrl: dto.oldImageUrl },
      { imageUrl: dto.newImageUrl },
    );
  }

  async updateMobileBannerImage(dto: UpdateAdminBrandImage) {
    await this.brandBannerImageRepository.update(
      { mobileImageUrl: dto.oldImageUrl },
      { mobileImageUrl: dto.newImageUrl },
    );
  }

  async updateSectionSortOrder(dto: UpdateAdminBrandSectionSortOrder) {
    await this.brandSectionRepository.update(
      { id: dto.sectionId },
      { sortOrder: dto.sortOrder },
    );
  }

  async updateSectionImage(dto: UpdateAdminBrandImage) {
    await this.brandSectionImageRepository.update(
      { imageUrl: dto.oldImageUrl },
      { imageUrl: dto.newImageUrl },
    );
  }

  async updateSectionImageSortOrder(
    dto: UpdateAdminBrandSectionImageSortOrder,
  ) {
    await this.brandSectionImageRepository.update(
      { imageUrl: dto.imageUrl },
      { sortOrder: dto.sortOrder },
    );
  }

  async delete(id: number) {
    await this.brandRepository.delete(id);
  }

  async deleteSectionImageBySectionId(sectionId: number) {
    await this.brandSectionImageRepository.delete({ sectionId });
  }

  async deleteAllBannerImages(brandId: number) {
    await this.brandBannerImageRepository.delete({ brandId });
  }

  async deleteAllMobileBannerImages(brandId: number) {
    await this.brandBannerImageRepository.delete({ brandId });
  }
}
