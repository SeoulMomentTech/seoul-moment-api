/* eslint-disable max-lines-per-function */
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminBrandListRequest,
  GetAdminBrandInfoResponse,
  GetAdminBrandNameDto,
  GetAdminBrandResponse,
  PostAdminBrandRequest,
} from './admin.brand.dto';

@Injectable()
export class AdminBrandService {
  constructor(
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async postAdminBrand(dto: PostAdminBrandRequest) {
    const brandEntity = await this.brandRepositoryService.insert(
      plainToInstance(BrandEntity, {
        categoryId: dto.categoryId,
        profileImage: dto.profileImageUrl ?? undefined,
        bannerImageUrl: dto.bannerImageUrl,
        englishName: dto.englishName,
      }),
    );

    const bannerEntities = dto.bannerImageUrlList.map((bannerUrl, index) =>
      plainToInstance(BrandBannerImageEntity, {
        brandId: brandEntity.id,
        imageUrl: bannerUrl,
        mobileImageUrl: dto.mobileBannerImageUrlList[index],
        sortOrder: index + 1,
      }),
    );

    await this.brandRepositoryService.bulkInsertInitBannerImage(bannerEntities);

    await Promise.all(
      dto.textList.flatMap((v) => [
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND,
          brandEntity.id,
          'name',
          v.languageId,
          v.name,
        ),
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND,
          brandEntity.id,
          'description',
          v.languageId,
          v.description,
        ),
      ]),
    );

    for (const v of dto.sectionList) {
      const brandSectionEntity =
        await this.brandRepositoryService.insertSection(
          plainToInstance(BrandSectionEntity, {
            brandId: brandEntity.id,
          }),
        );

      await Promise.all(
        v.textList.flatMap((text) => [
          this.languageRepositoryService.saveMultilingualText(
            EntityType.BRAND_SECTION,
            brandSectionEntity.id,
            'title',
            text.languageId,
            text.title,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.BRAND_SECTION,
            brandSectionEntity.id,
            'content',
            text.languageId,
            text.content,
          ),
        ]),
      );

      const brandSectionImages = v.imageUrlList.map((image, index) =>
        plainToInstance(BrandSectionImageEntity, {
          sectionId: brandSectionEntity.id,
          imageUrl: image,
          sortOrder: index + 1,
        }),
      );

      await this.brandRepositoryService.bulkInsertInitSectionImage(
        brandSectionImages,
      );
    }
  }

  async getAdminBrandInfo(id: number): Promise<GetAdminBrandInfoResponse> {
    const brandEntity = await this.brandRepositoryService.getBrandById(id);

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const brandMultilingualList: {
      languageId: number;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[] = [];

    for (const languageEntity of languageArray) {
      const [brandTexts, sectionTexts] = await Promise.all([
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.BRAND,
          brandEntity.id,
          languageEntity.code,
        ),
        this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.BRAND_SECTION,
          brandEntity.section.map((section) => section.id),
          languageEntity.code,
        ),
      ]);

      brandMultilingualList.push({
        languageId: languageEntity.id,
        brandText: brandTexts,
        sectionText: sectionTexts,
      });
    }

    return GetAdminBrandInfoResponse.from(brandEntity, brandMultilingualList);
  }

  async getAdminBrandList(
    request: AdminBrandListRequest,
  ): Promise<[GetAdminBrandResponse[], number]> {
    const [brandEntityList, total] =
      await this.brandRepositoryService.findBrandByFilter(
        request.page,
        request.count,
        request.search,
        request.searchColumn,
        request.sort,
      );

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const categoryList = await Promise.all(
      brandEntityList.map(async (brandEntity) => {
        const nameDto = await Promise.all(
          languageArray.map(async (languageEntity) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.BRAND,
                brandEntity.id,
                languageEntity.code,
                'name',
              );
            if (multilingualText.length > 0) {
              return GetAdminBrandNameDto.from(
                languageEntity.code,
                multilingualText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminBrandResponse.from(brandEntity, nameDto);
      }),
    );

    return [categoryList, total];
  }
}
