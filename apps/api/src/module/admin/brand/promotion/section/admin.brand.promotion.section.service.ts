import { Configuration } from '@app/config/configuration';
import { BrandPromotionSectionImageEntity } from '@app/repository/entity/brand-promotion-section-image.entity';
import { BrandPromotionSectionEntity } from '@app/repository/entity/brand-promotion-section.entity';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionSectionDetailResponse,
  GetAdminBrandPromotionSectionListRequest,
  GetAdminBrandPromotionSectionResponse,
  GetAdminBrandPromotionSectionTypeResponse,
  PatchAdminBrandPromotionSectionRequest,
  PostAdminBrandPromotionSectionRequest,
} from './admin.brand.promotion.section.dto';

@Injectable()
export class AdminBrandPromotionSectionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
  ) {}

  async getBrandPromotionSectionTypeList(): Promise<
    GetAdminBrandPromotionSectionTypeResponse[]
  > {
    const brandPromotionSectionTypes =
      await this.brandPromotionRepositoryService.findBrandPromotionSectionTypeList();

    return brandPromotionSectionTypes.map((brandPromotionSectionType) =>
      GetAdminBrandPromotionSectionTypeResponse.from(brandPromotionSectionType),
    );
  }

  @Transactional()
  async createBrandPromotionSection(
    request: PostAdminBrandPromotionSectionRequest,
  ): Promise<void> {
    const sectionEntity =
      await this.brandPromotionRepositoryService.createBrandPromotionSection(
        plainToInstance(BrandPromotionSectionEntity, {
          brandPromotionId: request.promotionId,
          typeId: request.typeId,
        }),
      );

    await Promise.all(
      request.imagePathList.map((imagePath) =>
        this.brandPromotionRepositoryService.createBrandPromotionSectionImage(
          plainToInstance(BrandPromotionSectionImageEntity, {
            brandPromotionSectionId: sectionEntity.id,
            imagePath,
          }),
        ),
      ),
    );
  }

  async getBrandPromotionSectionList(
    request: GetAdminBrandPromotionSectionListRequest,
  ): Promise<[GetAdminBrandPromotionSectionResponse[], number]> {
    const [brandPromotionSections, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionSectionList(
        request.page,
        request.count,
      );

    return [
      brandPromotionSections.map((brandPromotionSection) =>
        GetAdminBrandPromotionSectionResponse.from(brandPromotionSection),
      ),
      total,
    ];
  }

  async getBrandPromotionSectionDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionSectionDetailResponse> {
    const brandPromotionSection =
      await this.brandPromotionRepositoryService.getBrandPromotionSectionById(
        id,
      );
    return GetAdminBrandPromotionSectionDetailResponse.from(
      brandPromotionSection,
    );
  }

  @Transactional()
  async updateBrandPromotionSection(
    id: number,
    request: PatchAdminBrandPromotionSectionRequest,
  ): Promise<void> {
    await this.brandPromotionRepositoryService.updateBrandPromotionSection({
      id,
      typeId: request.typeId,
    });

    await this.brandPromotionRepositoryService.deleteBrandPromotionSectionImageByBrandPromotionSectionId(
      id,
    );

    await Promise.all(
      request.imageUrlList.map((imageUrl) =>
        this.brandPromotionRepositoryService.createBrandPromotionSectionImage(
          plainToInstance(BrandPromotionSectionImageEntity, {
            brandPromotionSectionId: id,
            imagePath: imageUrl.replace(
              Configuration.getConfig().IMAGE_DOMAIN_NAME,
              '',
            ),
          }),
        ),
      ),
    );
  }
}
