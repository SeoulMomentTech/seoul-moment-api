import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  UpdateBrandPromotionBannerDto,
  UpdateBrandPromotionBannerImageDto,
  UpdateBrandPromotionDto,
  UpdateBrandPromotionEventCouponDto,
  UpdateBrandPromotionEventDto,
  UpdateBrandPromotionNoticeDto,
  UpdateBrandPromotionPopupDto,
  UpdateBrandPromotionSectionDto,
  UpdateBrandPromotionSectionImageDto,
} from '../dto/brand-promotion.dto';
import { BrandPromotionBannerEntity } from '../entity/brand-promotion-banner.entity';
import { BrandPromotionBannerImageEntity } from '../entity/brand-promotion-banner.image.entity';
import { BrandPromotionEventCouponEntity } from '../entity/brand-promotion-event-coupon.entity';
import { BrandPromotionEventEntity } from '../entity/brand-promotion-event.entity';
import { BrandPromotionNoticeEntity } from '../entity/brand-promotion-notice.entity';
import { BrandPromotionPopupImageEntity } from '../entity/brand-promotion-popup-image.entity';
import { BrandPromotionPopupEntity } from '../entity/brand-promotion-popup.entity';
import { BrandPromotionSectionImageEntity } from '../entity/brand-promotion-section-image.entity';
import { BrandPromotionSectionEntity } from '../entity/brand-promotion-section.entity';
import { BrandPromotionEntity } from '../entity/brand-promotion.entity';
import { PromotionEntity } from '../entity/promotion.entity';
import { BrandPromotionEventStatus } from '../enum/brand-promotion-event.enum';

@Injectable()
export class BrandPromotionRepositoryService {
  constructor(
    @InjectRepository(PromotionEntity)
    private readonly promotionRepository: Repository<PromotionEntity>,

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

    @InjectRepository(BrandPromotionPopupEntity)
    private readonly brandPromotionPopupRepository: Repository<BrandPromotionPopupEntity>,

    @InjectRepository(BrandPromotionPopupImageEntity)
    private readonly brandPromotionPopupImageRepository: Repository<BrandPromotionPopupImageEntity>,

    @InjectRepository(BrandPromotionNoticeEntity)
    private readonly brandPromotionNoticeRepository: Repository<BrandPromotionNoticeEntity>,

    @InjectRepository(BrandPromotionEventEntity)
    private readonly brandPromotionEventRepository: Repository<BrandPromotionEventEntity>,

    @InjectRepository(BrandPromotionEventCouponEntity)
    private readonly brandPromotionEventCouponRepository: Repository<BrandPromotionEventCouponEntity>,
  ) {}

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

  async getBrandPromotionByBrandId(
    brandId: number,
  ): Promise<BrandPromotionEntity> {
    const result = await this.brandPromotionRepository.findOne({
      where: { brandId },
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
    const entity = this.brandPromotionBannerRepository.create(dto);
    return this.brandPromotionBannerRepository.save(
      Object.assign(entity, { updateDate: new Date() }),
    );
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

  async findBrandPromotionSectionList(
    page: number,
    count: number,
    brandPromotionId?: number,
  ): Promise<[BrandPromotionSectionEntity[], number]> {
    const qb = this.brandPromotionSectionRepository.createQueryBuilder('bps');
    if (brandPromotionId) {
      qb.where('bps.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      });
    }
    return qb
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bps.sortOrder', 'DESC')
      .leftJoinAndSelect('bps.images', 'images')
      .getManyAndCount();
  }

  async findBrandPromotionSectionListByBrandPromotionId(
    brandPromotionId: number,
  ): Promise<BrandPromotionSectionEntity[]> {
    return this.brandPromotionSectionRepository.find({
      where: { brandPromotionId },
      relations: ['images'],
    });
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

  async findBrandPromotionBannerListByBrandPromotionId(
    brandPromotionId: number,
  ): Promise<BrandPromotionBannerEntity[]> {
    const qb = this.brandPromotionBannerRepository.createQueryBuilder('bpb');
    return qb
      .leftJoinAndSelect('bpb.images', 'images')
      .where('bpb.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      })
      .orderBy('bpb.createDate', 'DESC')
      .getMany();
  }

  async findBrandPromotionBannerListByPaging(
    page: number,
    count: number,
    brandPromotionId?: number,
  ): Promise<[BrandPromotionBannerEntity[], number]> {
    const qb = this.brandPromotionBannerRepository.createQueryBuilder('bpb');

    if (brandPromotionId) {
      qb.where('bpb.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      });
    }

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

  async createBrandPromotionNotice(
    entity: BrandPromotionNoticeEntity,
  ): Promise<BrandPromotionNoticeEntity> {
    return this.brandPromotionNoticeRepository.save(entity);
  }

  async findBrandPromotionNoticeListByPaging(
    page: number,
    count: number,
    brandPromotionId?: number,
  ): Promise<[BrandPromotionNoticeEntity[], number]> {
    const qb = this.brandPromotionNoticeRepository.createQueryBuilder('bpn');

    if (brandPromotionId) {
      qb.where('bpn.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      });
    }

    return qb
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bpn.createDate', 'DESC')
      .getManyAndCount();
  }

  async updateBrandPromotionNotice(
    dto: UpdateBrandPromotionNoticeDto,
  ): Promise<BrandPromotionNoticeEntity> {
    return this.brandPromotionNoticeRepository.save(dto);
  }

  async deleteBrandPromotionNotice(id: number) {
    await this.brandPromotionNoticeRepository.delete(id);
  }

  async getBrandPromotionNoticeById(
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

  async createBrandPromotionPopup(
    entity: BrandPromotionPopupEntity,
  ): Promise<BrandPromotionPopupEntity> {
    return this.brandPromotionPopupRepository.save(entity);
  }

  async createBrandPromotionPopupImage(
    image: BrandPromotionPopupImageEntity,
  ): Promise<BrandPromotionPopupImageEntity> {
    return this.brandPromotionPopupImageRepository.save(image);
  }

  async findBrandPromotionPopupListByPaging(
    page: number,
    count: number,
    brandPromotionId?: number,
  ): Promise<[BrandPromotionPopupEntity[], number]> {
    const qb = this.brandPromotionPopupRepository.createQueryBuilder('bp');

    if (brandPromotionId) {
      qb.where('bp.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      });
    }

    return qb
      .skip((page - 1) * count)
      .take(count)
      .leftJoinAndSelect('bp.images', 'images')
      .orderBy('bp.createDate', 'DESC')
      .getManyAndCount();
  }

  async getBrandPromotionPopupById(
    id: number,
  ): Promise<BrandPromotionPopupEntity> {
    const result = await this.brandPromotionPopupRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion popup not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async updateBrandPromotionPopup(
    dto: UpdateBrandPromotionPopupDto,
  ): Promise<BrandPromotionPopupEntity> {
    const entity = this.brandPromotionPopupRepository.create(dto);
    return this.brandPromotionPopupRepository.save(
      Object.assign(entity, { updateDate: new Date() }),
    );
  }

  async deleteBrandPromotionPopup(id: number): Promise<void> {
    await this.brandPromotionPopupRepository.delete(id);
  }

  async deleteBrandPromotionPopupImageByBrandPromotionPopupId(
    brandPromotionPopupId: number,
  ): Promise<void> {
    await this.brandPromotionPopupImageRepository.delete({
      brandPromotionPopupId,
    });
  }

  async createBrandPromotionEvent(
    entity: BrandPromotionEventEntity,
  ): Promise<BrandPromotionEventEntity> {
    return this.brandPromotionEventRepository.save(entity);
  }

  async findBrandPromotionEventListByPaging(
    page: number,
    count: number,
    brandPromotionId?: number,
    status?: BrandPromotionEventStatus,
  ): Promise<[BrandPromotionEventEntity[], number]> {
    const qb = this.brandPromotionEventRepository.createQueryBuilder('bpe');
    if (brandPromotionId) {
      qb.where('bpe.brandPromotionId = :brandPromotionId', {
        brandPromotionId,
      });
    }
    if (status) {
      qb.where('bpe.status = :status', { status });
    }
    return qb
      .leftJoinAndSelect('bpe.coupons', 'coupons')
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bpe.createDate', 'DESC')
      .getManyAndCount();
  }

  async getBrandPromotionEventById(
    id: number,
    status?: BrandPromotionEventStatus,
  ): Promise<BrandPromotionEventEntity> {
    const qb = this.brandPromotionEventRepository.createQueryBuilder('bpe');
    if (status) {
      qb.where('bpe.status = :status', { status });
    }
    const result = await qb.where('bpe.id = :id', { id }).getOne();

    if (!result) {
      throw new ServiceError(
        'Brand promotion event not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async getBrandPromotionEventByBrandPromotionId(
    brandPromotionId: number,
    status?: BrandPromotionEventStatus,
  ): Promise<BrandPromotionEventEntity> {
    const qb = this.brandPromotionEventRepository.createQueryBuilder('bpe');
    if (status) {
      qb.where('bpe.status = :status', { status });
    }
    const result = await qb
      .where('bpe.brandPromotionId = :brandPromotionId', { brandPromotionId })
      .getOne();

    if (!result) {
      throw new ServiceError(
        'Brand promotion event not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async updateBrandPromotionEvent(
    dto: UpdateBrandPromotionEventDto,
  ): Promise<BrandPromotionEventEntity> {
    const entity = this.brandPromotionEventRepository.create(dto);

    return this.brandPromotionEventRepository.save(
      Object.assign(entity, { updateDate: new Date() }),
    );
  }

  async deleteBrandPromotionEvent(id: number): Promise<void> {
    await this.brandPromotionEventRepository.delete(id);
  }

  async createBrandPromotionEventCoupon(
    entity: BrandPromotionEventCouponEntity,
  ): Promise<BrandPromotionEventCouponEntity> {
    return this.brandPromotionEventCouponRepository.save(entity);
  }

  async updateBrandPromotionEventCoupon(
    dto: UpdateBrandPromotionEventCouponDto,
  ): Promise<BrandPromotionEventCouponEntity> {
    return this.brandPromotionEventCouponRepository.save(dto);
  }

  async deleteBrandPromotionEventCoupon(id: number): Promise<void> {
    await this.brandPromotionEventCouponRepository.delete(id);
  }

  async findBrandPromotionEventCouponListByPaging(
    page: number,
    count: number,
    brandPromotionEventId?: number,
  ): Promise<[BrandPromotionEventCouponEntity[], number]> {
    const qb =
      this.brandPromotionEventCouponRepository.createQueryBuilder('bpec');

    if (brandPromotionEventId) {
      qb.where('bpec.brandPromotionEventId = :brandPromotionEventId', {
        brandPromotionEventId,
      });
    }

    return qb
      .skip((page - 1) * count)
      .take(count)
      .orderBy('bpec.createDate', 'DESC')
      .getManyAndCount();
  }

  async getBrandPromotionEventCouponById(
    id: number,
  ): Promise<BrandPromotionEventCouponEntity> {
    const result = await this.brandPromotionEventCouponRepository.findOne({
      where: { id },
    });

    if (!result) {
      throw new ServiceError(
        'Brand promotion event coupon not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }
}
