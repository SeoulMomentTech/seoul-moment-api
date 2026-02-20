import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminRoleEntity } from './entity/admin-role.entity';
import { AdminEntity } from './entity/admin.entity';
import { ArticleSectionImageEntity } from './entity/article-section-image.entity';
import { ArticleSectionEntity } from './entity/article-section.entity';
import { ArticleEntity } from './entity/article.entity';
import { BrandBannerImageEntity } from './entity/brand-banner-image.entity';
import { BrandMobileBannerImageEntity } from './entity/brand-mobile-banner-image.entity';
import { BrandSectionImageEntity } from './entity/brand-section-image.entity';
import { BrandSectionEntity } from './entity/brand-section.entity';
import { BrandEntity } from './entity/brand.entity';
import { CategoryEntity } from './entity/category.entity';
import { ChatMessageEntity } from './entity/chat-message.entity';
import { ExternalLinkEntity } from './entity/external-link.entity';
import { HomeBannerImageEntity } from './entity/home-banner-image.entity';
import { HomeSectionImageEntity } from './entity/home-section-image.entity';
import { HomeSectionEntity } from './entity/home-section.entity';
import { LanguageEntity } from './entity/language.entity';
import { MultilingualTextEntity } from './entity/multilingual-text.entity';
import { NewsSectionImageEntity } from './entity/news-section-image.entity';
import { NewsSectionEntity } from './entity/news-section.entity';
import { NewsEntity } from './entity/news.entity';
import { OptionValueEntity } from './entity/option-value.entity';
import { OptionEntity } from './entity/option.entity';
import { PartnerCategoryEntity } from './entity/partner-category.entity';
import { PartnerEntity } from './entity/partner.entity';
import { PlanCategoryEntity } from './entity/plan-category.entity';
import { PlanScheduleEntity } from './entity/plan-schedule.entity';
import { PlanUserCategoryEntity } from './entity/plan-user-category.entity';
import { PlanUserRoomMemberEntity } from './entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from './entity/plan-user-room.entity';
import { PlanUserEntity } from './entity/plan-user.entity';
import { ProductBannerEntity } from './entity/product-banner.entity';
import { ProductCategoryEntity } from './entity/product-category.entity';
import { ProductExternalEntity } from './entity/product-external.entity';
import { ProductFilterEntity } from './entity/product-filter.entity';
import { ProductImageEntity } from './entity/product-image.entity';
import { ProductItemImageEntity } from './entity/product-item-image.entity';
import { ProductItemEntity } from './entity/product-item.entity';
import { ProductVariantEntity } from './entity/product-variant.entity';
import { ProductEntity } from './entity/product.entity';
import { VariantOptionEntity } from './entity/variant-option.entity';
import { SortOrderHelper } from './helper/sort-order.helper';
import { AdminRoleRepositoryService } from './service/admin-role.repository.service';
import { AdminRepositoryService } from './service/admin.repository.service';
import { ArticleRepositoryService } from './service/article.repository.service';
import { BrandRepositoryService } from './service/brand.repository.service';
import { CategoryRepositoryService } from './service/category.repository.service';
import { ChatMessageRepositoryService } from './service/chat-message.repository.service';
import { HomeRepositoryService } from './service/home.repository.service';
import { LanguageRepositoryService } from './service/language.repository.service';
import { NewsRepositoryService } from './service/news.repository.service';
import { OptionRepositoryService } from './service/option.repository.service';
import { PartnerRepositoryService } from './service/partner.repository.service';
import { PlanCategoryRepositoryService } from './service/plan-category.repository.service';
import { PlanScheduleRepositoryService } from './service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from './service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from './service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from './service/plan-user.repository.service';
import { ProductFilterRepositoryService } from './service/product-filter.repository.service';
import { ProductRepositoryService } from './service/product.repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandMobileBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
      LanguageEntity,
      MultilingualTextEntity,
      CategoryEntity,
      NewsEntity,
      NewsSectionEntity,
      NewsSectionImageEntity,
      ArticleEntity,
      ArticleSectionEntity,
      ArticleSectionImageEntity,
      HomeSectionEntity,
      HomeSectionImageEntity,
      HomeBannerImageEntity,
      ProductEntity,
      ProductBannerEntity,
      ProductCategoryEntity,
      ProductItemEntity,
      ProductItemImageEntity,
      ProductImageEntity,
      ProductVariantEntity,
      OptionEntity,
      OptionValueEntity,
      VariantOptionEntity,
      PartnerEntity,
      PartnerCategoryEntity,
      ProductFilterEntity,
      AdminEntity,
      ProductExternalEntity,
      ExternalLinkEntity,
      AdminRoleEntity,
      PlanUserEntity,
      PlanScheduleEntity,
      PlanCategoryEntity,
      PlanUserCategoryEntity,
      PlanUserRoomEntity,
      PlanUserRoomMemberEntity,
      ChatMessageEntity,
    ]),
  ],
  providers: [
    SortOrderHelper,
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
    HomeRepositoryService,
    ProductRepositoryService,
    CategoryRepositoryService,
    PartnerRepositoryService,
    OptionRepositoryService,
    ProductFilterRepositoryService,
    AdminRepositoryService,
    AdminRoleRepositoryService,
    AdminRepositoryService,
    PlanUserRepositoryService,
    PlanScheduleRepositoryService,
    PlanCategoryRepositoryService,
    PlanUserRoomRepositoryService,
    PlanUserRoomMemberRepositoryService,
    ChatMessageRepositoryService,
  ],
  exports: [
    SortOrderHelper,
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
    HomeRepositoryService,
    ProductRepositoryService,
    CategoryRepositoryService,
    PartnerRepositoryService,
    OptionRepositoryService,
    ProductFilterRepositoryService,
    AdminRepositoryService,
    AdminRoleRepositoryService,
    PlanUserRepositoryService,
    PlanScheduleRepositoryService,
    PlanCategoryRepositoryService,
    PlanUserRoomRepositoryService,
    PlanUserRoomMemberRepositoryService,
    ChatMessageRepositoryService,
  ],
})
export class RepositoryModule {}
