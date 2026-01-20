/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { UpdateBrandDto } from '@app/repository/dto/brand.dto';
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandMobileBannerImageEntity } from '@app/repository/entity/brand-mobile-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminBrandListRequest,
  GetAdminBrandInfoResponse,
  GetAdminBrandInfoText,
  GetAdminBrandNameDto,
  GetAdminBrandResponse,
  PostAdminBrandRequest,
  UpdateAdminBrandRequest,
  V2UpdateAdminBrandRequest,
} from './admin.brand.dto';

@Injectable()
export class AdminBrandService {
  constructor(
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async postAdminBrand(dto: PostAdminBrandRequest) {
    const brandEntity = await this.brandRepositoryService.insert(
      plainToInstance(BrandEntity, {
        categoryId: dto.categoryId,
        profileImage: dto.profileImageUrl ?? undefined,
        bannerImageUrl: dto.productBannerImageUrl,
        englishName: dto.englishName,
      }),
    );

    const bannerEntities = dto.bannerImageUrlList.map((bannerUrl, index) =>
      plainToInstance(BrandBannerImageEntity, {
        brandId: brandEntity.id,
        imageUrl: bannerUrl,
        sortOrder: index + 1,
      }),
    );

    await this.brandRepositoryService.bulkInsertInitBannerImage(bannerEntities);

    if (
      dto.mobileBannerImageUrlList &&
      dto.mobileBannerImageUrlList.length > 0
    ) {
      const mobileBannerEntities = dto.mobileBannerImageUrlList.map(
        (mobileBannerUrl, index) =>
          plainToInstance(BrandMobileBannerImageEntity, {
            brandId: brandEntity.id,
            imageUrl: mobileBannerUrl,
            sortOrder: index + 1,
          }),
      );

      await this.brandRepositoryService.bulkInsertInitMobileBannerImage(
        mobileBannerEntities,
      );
    }

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

    const brandList = await Promise.all(
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

    return [brandList, total];
  }

  @Transactional()
  async updateAdminBrand(brandId: number, dto: UpdateAdminBrandRequest) {
    await this.categoryRepositoryService.getCategoryById(dto.categoryId);

    const updateBrandDto: UpdateBrandDto = {
      id: brandId,
      englishName: dto.englishName,
      profileImage: dto.profileImageUrl,
      bannerImageUrl: dto.productBannerImage,
    };

    await this.brandRepositoryService.update(updateBrandDto);

    if (dto.bannerImageUrlList && dto.bannerImageUrlList.length > 0) {
      for (const banner of dto.bannerImageUrlList) {
        if (banner.oldImageUrl === '' || banner.oldImageUrl === null) {
          await this.brandRepositoryService.insertBannerImage(
            plainToInstance(BrandBannerImageEntity, {
              brandId,
              imageUrl: banner.newImageUrl,
            }),
          );
        } else {
          await this.brandRepositoryService.updateBannerImage(banner);
        }
      }
    }

    if (
      dto.mobileBannerImageUrlList &&
      dto.mobileBannerImageUrlList.length > 0
    ) {
      for (const banner of dto.mobileBannerImageUrlList) {
        if (banner.oldImageUrl === '' || banner.oldImageUrl === null) {
          await this.brandRepositoryService.insertMobileBannerImage(
            plainToInstance(BrandMobileBannerImageEntity, {
              brandId,
              imageUrl: banner.newImageUrl,
            }),
          );
        } else {
          // TODO: updateMobileBannerImage 메서드 구현 필요 (기존 방식 유지)
          // 또는 전체 교체 방식으로 변경
        }
      }
    }

    if (dto.sectionSortOrderList && dto.sectionSortOrderList.length > 0) {
      await Promise.all(
        dto.sectionSortOrderList.map((sortOrder) =>
          this.brandRepositoryService.updateSectionSortOrder(sortOrder),
        ),
      );
    }

    const promises = [];

    if (dto.textList && dto.textList.length > 0) {
      for (const text of dto.textList) {
        if (text.name) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.BRAND,
              brandId,
              'name',
              text.languageId,
              text.name,
            ),
          );
        }
        if (text.description) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.BRAND,
              brandId,
              'description',
              text.languageId,
              text.description,
            ),
          );
        }
      }
    }

    if (dto.sectionList && dto.sectionList.length > 0) {
      for (const section of dto.sectionList) {
        if (section.textList && section.textList.length > 0) {
          for (const text of section.textList) {
            if (text.title) {
              promises.push(
                this.languageRepositoryService.saveMultilingualText(
                  EntityType.BRAND_SECTION,
                  section.id,
                  'title',
                  text.languageId,
                  text.title,
                ),
              );
            }
            if (text.content) {
              promises.push(
                this.languageRepositoryService.saveMultilingualText(
                  EntityType.BRAND_SECTION,
                  section.id,
                  'content',
                  text.languageId,
                  text.content,
                ),
              );
            }
          }
        }

        if (section.imageUrlList && section.imageUrlList.length > 0) {
          for (const imageUrl of section.imageUrlList) {
            if (imageUrl.oldImageUrl === '' || imageUrl.oldImageUrl === null) {
              promises.push(
                this.brandRepositoryService.insertSectionImage(
                  plainToInstance(BrandSectionImageEntity, {
                    sectionId: section.id,
                    imageUrl: imageUrl.newImageUrl,
                  }),
                ),
              );
            } else {
              promises.push(
                this.brandRepositoryService.updateSectionImage(imageUrl),
              );
            }
          }
        }

        if (
          section.imageSortOrderList &&
          section.imageSortOrderList.length > 0
        ) {
          for (const sortOrder of section.imageSortOrderList) {
            promises.push(
              this.brandRepositoryService.updateSectionImageSortOrder(
                sortOrder,
              ),
            );
          }
        }
      }
    }

    await Promise.all(promises);
  }

  @Transactional()
  async deleteAdminBrand(brandId: number) {
    const brandEntity = await this.brandRepositoryService.getBrandById(brandId);

    await this.brandRepositoryService.delete(brandId);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND,
      brandId,
    );

    await Promise.all(
      brandEntity.section.map((section) =>
        this.languageRepositoryService.deleteMultilingualTexts(
          EntityType.BRAND_SECTION,
          section.id,
        ),
      ),
    );
  }

  @Transactional()
  async brandMultilingualUpdate(
    brandId: number,
    list: GetAdminBrandInfoText[],
  ) {
    const newContentList: GetAdminBrandInfoText[] = [];

    for (const content of list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.BRAND,
        brandId,
        'name',
        content.languageId,
        content.name,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.BRAND,
        brandId,
        'description',
        content.languageId,
        content.description,
      );

      for (const section of content.section) {
        const sectionId = section.id;

        if (!sectionId) {
          newContentList.push(content);
          continue;
        }

        await this.updateBrandSection(sectionId, content.languageId, section);
      }
    }

    const activeLanguage =
      await this.languageRepositoryService.findAllActiveLanguages();

    if (newContentList.length > 0) {
      if (activeLanguage.length === newContentList.length) {
        const newSectionEntity =
          await this.brandRepositoryService.insertSection(
            plainToInstance(BrandSectionEntity, {
              brandId,
            }),
          );

        for (const content of newContentList) {
          for (const section of content.section) {
            await this.updateBrandSection(
              newSectionEntity.id,
              content.languageId,
              section,
            );
          }
        }
      } else {
        throw new ServiceError(
          `섹션을 추가하려면 활성 언어 수(${activeLanguage.length})와 동일한 개수의 언어별 입력이 필요합니다. 현재 새로운 섹션은 ${newContentList.length}개 추가되었습니다.`,
          ServiceErrorCode.GONE,
        );
      }
    }
  }

  private async updateBrandSection(
    sectionId: number,
    languageId: number,
    section: any,
  ) {
    await this.languageRepositoryService.saveMultilingualText(
      EntityType.BRAND_SECTION,
      sectionId,
      'title',
      languageId,
      section.title,
    );

    await this.languageRepositoryService.saveMultilingualText(
      EntityType.BRAND_SECTION,
      sectionId,
      'content',
      languageId,
      section.content,
    );

    await this.brandRepositoryService.deleteSectionImageBySectionId(sectionId);

    for (const image of section.imageList) {
      await this.brandRepositoryService.insertSectionImage(
        plainToInstance(BrandSectionImageEntity, {
          sectionId,
          imageUrl: image.replace(
            Configuration.getConfig().IMAGE_DOMAIN_NAME,
            '',
          ),
        }),
      );
    }
  }

  @Transactional()
  async V2UpdateAdminBrand(brandId: number, dto: V2UpdateAdminBrandRequest) {
    const brandEntity = await this.brandRepositoryService.getBrandById(brandId);

    const updateBrandDto: UpdateBrandDto = {
      id: brandId,
      categoryId: dto.categoryId,
      englishName: dto.englishName,
      profileImage: dto.profileImage?.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
      bannerImageUrl: dto.productBannerImage?.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
    };

    await this.brandRepositoryService.update(updateBrandDto);

    // Banner 이미지 전체 교체 (각각 독립적으로 처리)
    if (dto.bannerList) {
      await this.brandRepositoryService.deleteAllBannerImages(brandId);

      const bannerEntities = dto.bannerList.map((bannerUrl, index) =>
        plainToInstance(BrandBannerImageEntity, {
          brandId,
          imageUrl: bannerUrl.replace(
            Configuration.getConfig().IMAGE_DOMAIN_NAME,
            '',
          ),
          sortOrder: index + 1,
        }),
      );

      if (bannerEntities.length > 0) {
        await this.brandRepositoryService.bulkInsertInitBannerImage(
          bannerEntities,
        );
      }
    }

    // Mobile Banner 이미지 전체 교체 (각각 독립적으로 처리)
    if (dto.mobileBannerList) {
      await this.brandRepositoryService.deleteAllMobileBannerImages(brandId);

      const mobileBannerEntities = dto.mobileBannerList.map(
        (mobileBannerUrl, index) =>
          plainToInstance(BrandMobileBannerImageEntity, {
            brandId,
            imageUrl: mobileBannerUrl.replace(
              Configuration.getConfig().IMAGE_DOMAIN_NAME,
              '',
            ),
            sortOrder: index + 1,
          }),
      );

      if (mobileBannerEntities.length > 0) {
        await this.brandRepositoryService.bulkInsertInitMobileBannerImage(
          mobileBannerEntities,
        );
      }
    }

    await this.V2brandMultilingualUpdate(
      brandEntity.id,
      dto.multilingualTextList,
    );
  }

  @Transactional()
  async V2brandMultilingualUpdate(
    brandId: number,
    list: GetAdminBrandInfoText[],
  ) {
    await this.deleteBrandMultilingual(brandId);

    if (!list || list.length === 0) {
      return;
    }

    const firstContent = list[0];
    const sectionEntities: BrandSectionEntity[] = [];

    // 섹션 엔티티 생성
    for (let i = 0; i < firstContent.section.length; i++) {
      const sectionEntity = await this.brandRepositoryService.insertSection(
        plainToInstance(BrandSectionEntity, {
          brandId,
        }),
      );
      sectionEntities.push(sectionEntity);
    }

    // 각 언어별 브랜드 텍스트 저장
    for (const content of list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.BRAND,
        brandId,
        'name',
        content.languageId,
        content.name,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.BRAND,
        brandId,
        'description',
        content.languageId,
        content.description,
      );
    }

    // 각 섹션별로 다국어 데이터 저장
    for (
      let sectionIndex = 0;
      sectionIndex < sectionEntities.length;
      sectionIndex++
    ) {
      const sectionEntity = sectionEntities[sectionIndex];

      // 각 언어별 섹션 데이터 저장
      for (const content of list) {
        const sectionData = content.section[sectionIndex];
        if (!sectionData) {
          continue;
        }

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_SECTION,
          sectionEntity.id,
          'title',
          content.languageId,
          sectionData.title,
        );
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_SECTION,
          sectionEntity.id,
          'content',
          content.languageId,
          sectionData.content,
        );
      }

      // 섹션 이미지 저장 (첫 번째 언어의 이미지 리스트 사용)
      const firstSectionData = list[0]?.section[sectionIndex];
      const imageList = firstSectionData?.imageList || [];

      for (const image of imageList) {
        await this.brandRepositoryService.insertSectionImage(
          plainToInstance(BrandSectionImageEntity, {
            sectionId: sectionEntity.id,
            imageUrl: image.replace(
              Configuration.getConfig().IMAGE_DOMAIN_NAME,
              '',
            ),
          }),
        );
      }
    }
  }

  @Transactional()
  async deleteBrandMultilingual(brandId: number) {
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND,
      brandId,
    );

    const brandEntity = await this.brandRepositoryService.getBrandById(brandId);
    const sectionEntityList = brandEntity.section || [];

    for (const section of sectionEntityList) {
      await this.languageRepositoryService.deleteMultilingualTexts(
        EntityType.BRAND_SECTION,
        section.id,
      );

      await this.brandRepositoryService.deleteSectionImageBySectionId(
        section.id,
      );

      await this.brandRepositoryService.deleteSectionById(section.id);
    }
  }
}
