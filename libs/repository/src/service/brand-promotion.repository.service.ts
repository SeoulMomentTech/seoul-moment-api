import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  UpdateBrandPromotionBannerDto,
  UpdateBrandPromotionBannerImageDto,
  UpdateBrandPromotionDto,
  UpdateBrandPromotionNoticsDto,
  UpdateBrandPromotionSectionDto,
  UpdateBrandPromotionSectionImageDto,
} from '../dto/brand-promotion.dto';
import { BrandPromotionBannerEntity } from '../entity/brand-promotion-banner.entity';
import { BrandPromotionBannerImageEntity } from '../entity/brand-promotion-banner.image.entity';
import { BrandPromotionNoticeEntity } from '../entity/brand-promotion-notice.entity';
import { BrandPromotionPopupImageEntity } from '../entity/brand-promotion-popup-image.entity';
import { BrandPromotionPopupEntity } from '../entity/brand-promotion-popup.entity';
import { BrandPromotionSectionImageEntity } from '../entity/brand-promotion-section-image.entity';
import { BrandPromotionSectionTypeEntity } from '../entity/brand-promotion-section-type.entity';
import { BrandPromotionSectionEntity } from '../entity/brand-promotion-section.entity';
import { BrandPromotionEntity } from '../entity/brand-promotion.entity';

@Injectable()
export class BrandPromotionRepositoryService implements OnModuleInit {
  constructor(
    @InjectRepository(BrandPromotionEntity)
    private readonly brandPromotionRepository: Repository<BrandPromotionEntity>,

    @InjectRepository(BrandPromotionBannerEntity)
    private readonly brandPromotionBannerRepository: Repository<BrandPromotionBannerEntity>,

    @InjectRepository(BrandPromotionBannerImageEntity)
    private readonly brandPromotionBannerImageRepository: Repository<BrandPromotionBannerImageEntity>,

    @InjectRepository(BrandPromotionSectionEntity)
    private readonly brandPromotionSectionRepository: Repository<BrandPromotionSectionEntity>,

    @InjectRepository(BrandPromotionSectionImageEntity)
    private readonly brandPromotionSectionImageRepository: Repository<BrandPromotionSectionImageEntity>,

    @InjectRepository(BrandPromotionSectionTypeEntity)
    private readonly brandPromotionSectionTypeRepository: Repository<BrandPromotionSectionTypeEntity>,

    @InjectRepository(BrandPromotionPopupEntity)
    private readonly brandPromotionPopupRepository: Repository<BrandPromotionPopupEntity>,

    @InjectRepository(BrandPromotionPopupImageEntity)
    private readonly brandPromotionPopupImageRepository: Repository<BrandPromotionPopupImageEntity>,

    @InjectRepository(BrandPromotionNoticeEntity)
    private readonly brandPromotionNoticeRepository: Repository<BrandPromotionNoticeEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.brandPromotionSectionTypeRepository.count();
    if (count === 0) {
      const types = [
        { id: 'TYPE_1', description: '정가운데 이미지 하나', imageCount: 1 },
        { id: 'TYPE_2', description: '정가운데 이미지 두개', imageCount: 2 },
        { id: 'TYPE_4', description: '정가운데 이미지 네개', imageCount: 4 },
        { id: 'TYPE_5', description: '좌측 이미지 하나', imageCount: 1 },
        {
          id: 'TYPE_6',
          description: '정가운데 와이드 이미지 하나',
          imageCount: 1,
        },
      ];
      await this.brandPromotionSectionTypeRepository.save(types);
    }
  }

  async createBrandPromotion(
    brandPromotion: BrandPromotionEntity,
  ): Promise<BrandPromotionEntity> {
    return this.brandPromotionRepository.save(brandPromotion);
  }

  async updateBrandPromotion(
    dto: UpdateBrandPromotionDto,
  ): Promise<BrandPromotionEntity> {
    return this.brandPromotionRepository.save(dto);
  }

  async deleteBrandPromotion(id: number): Promise<void> {
    await this.brandPromotionRepository.delete(id);
  }

  async getBrandPromotionById(id: number): Promise<BrandPromotionEntity> {
    const result = await this.brandPromotionRepository.findOne({
      where: { id },
      relations: [
        'brand',
        'banners',
        'popups',
        'popups.images',
        'notices',
        'sections',
        'sections.images',
      ],
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion not found or not in normal status',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findBrandPromotionList(): Promise<BrandPromotionEntity[]> {
    return this.brandPromotionRepository.find({
      where: { isActive: true },
      relations: ['brand'],
    });
  }

  async findBrandPromotionListByPaging(
    page: number,
    count: number,
    brandName?: string,
  ): Promise<[BrandPromotionEntity[], number]> {
    const qb = this.brandPromotionRepository
      .createQueryBuilder('bp')
      .leftJoinAndSelect('bp.brand', 'brand')
      .where('bp.isActive = :isActive', { isActive: true })
      .skip((page - 1) * count)
      .take(count);

    if (brandName) {
      qb.andWhere('brand.englishName LIKE :brandName', {
        brandName: `%${brandName}%`,
      });
    }

    return qb.getManyAndCount();
  }

  async createBrandPromotionBanner(
    banner: BrandPromotionBannerEntity,
  ): Promise<BrandPromotionBannerEntity> {
    return this.brandPromotionBannerRepository.save(banner);
  }

  async updateBrandPromotionBanner(
    dto: UpdateBrandPromotionBannerDto,
  ): Promise<BrandPromotionBannerEntity> {
    return this.brandPromotionBannerRepository.save(dto);
  }

  async updateBrandPromotionBannerImage(
    dto: UpdateBrandPromotionBannerImageDto,
  ): Promise<BrandPromotionBannerImageEntity> {
    return this.brandPromotionBannerImageRepository.save(dto);
  }

  async deleteBrandPromotionBanner(id: number): Promise<void> {
    await this.brandPromotionBannerRepository.delete(id);
  }

  async deleteBrandPromotionBannerImageByBrandPromotionBannerId(
    brandPromotionBannerId: number,
  ): Promise<void> {
    await this.brandPromotionBannerImageRepository.delete({
      brandPromotionBannerId,
    });
  }

  async createBrandPromotionBannerImage(
    image: BrandPromotionBannerImageEntity,
  ): Promise<BrandPromotionBannerImageEntity> {
    return this.brandPromotionBannerImageRepository.save(image);
  }

  async createBrandPromotionSection(
    section: BrandPromotionSectionEntity,
  ): Promise<BrandPromotionSectionEntity> {
    return this.brandPromotionSectionRepository.save(section);
  }

  async updateBrandPromotionSection(
    dto: UpdateBrandPromotionSectionDto,
  ): Promise<BrandPromotionSectionEntity> {
    return this.brandPromotionSectionRepository.save(dto);
  }

  async deleteBrandPromotionSection(id: number): Promise<void> {
    await this.brandPromotionSectionRepository.delete(id);
  }

  async createBrandPromotionSectionImage(
    image: BrandPromotionSectionImageEntity,
  ): Promise<BrandPromotionSectionImageEntity> {
    return this.brandPromotionSectionImageRepository.save(image);
  }

  async updateBrandPromotionSectionImage(
    dto: UpdateBrandPromotionSectionImageDto,
  ): Promise<BrandPromotionSectionImageEntity> {
    return this.brandPromotionSectionImageRepository.save(dto);
  }

  async deleteBrandPromotionSectionImage(id: number): Promise<void> {
    await this.brandPromotionSectionImageRepository.delete(id);
  }

  async deleteBrandPromotionSectionImageByBrandPromotionSectionId(
    brandPromotionSectionId: number,
  ): Promise<void> {
    await this.brandPromotionSectionImageRepository.delete({
      brandPromotionSectionId,
    });
  }

  async findBrandPromotionSectionTypeList(): Promise<
    BrandPromotionSectionTypeEntity[]
  > {
    return this.brandPromotionSectionTypeRepository.find();
  }

  async findBrandPromotionSectionList(
    page: number,
    count: number,
  ): Promise<[BrandPromotionSectionEntity[], number]> {
    const qb = this.brandPromotionSectionRepository.createQueryBuilder('bps');
    return qb
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bps.sortOrder', 'DESC')
      .leftJoinAndSelect('bps.images', 'images')
      .getManyAndCount();
  }

  async getBrandPromotionSectionById(
    id: number,
  ): Promise<BrandPromotionSectionEntity> {
    const result = await this.brandPromotionSectionRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion section not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async findBrandPromotionBannerListByPaging(
    page: number,
    count: number,
  ): Promise<[BrandPromotionBannerEntity[], number]> {
    const qb = this.brandPromotionBannerRepository.createQueryBuilder('bpb');
    return qb
      .skip((page - 1) * count)
      .take(count)
      .leftJoinAndSelect('bpb.images', 'images')
      .orderBy('bpb.createDate', 'DESC')
      .getManyAndCount();
  }

  async getBrandPromotionBannerById(
    id: number,
  ): Promise<BrandPromotionBannerEntity> {
    const result = await this.brandPromotionBannerRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion banner not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async createBrandPromotionNotics(
    entity: BrandPromotionNoticeEntity,
  ): Promise<BrandPromotionNoticeEntity> {
    return this.brandPromotionNoticeRepository.save(entity);
  }

  async findBrandPromotionNoticsListByPaging(
    page: number,
    count: number,
  ): Promise<[BrandPromotionNoticeEntity[], number]> {
    const qb = this.brandPromotionNoticeRepository.createQueryBuilder('bpn');
    return qb
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bpn.createDate', 'DESC')
      .getManyAndCount();
  }

  async updateBrandPromotionNotics(
    dto: UpdateBrandPromotionNoticsDto,
  ): Promise<BrandPromotionNoticeEntity> {
    return this.brandPromotionNoticeRepository.save(dto);
  }

  async deleteBrandPromotionNotics(id: number) {
    await this.brandPromotionNoticeRepository.delete(id);
  }

  async getBrandPromotionNoticsById(
    id: number,
  ): Promise<BrandPromotionNoticeEntity> {
    const result = await this.brandPromotionNoticeRepository.findOne({
      where: { id },
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion notice not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }
}
