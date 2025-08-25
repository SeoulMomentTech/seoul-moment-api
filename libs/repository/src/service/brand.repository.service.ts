import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BrandEntity } from '../entity/brand.entity';
import { Repository } from 'typeorm';
import { BrandStatus } from '../enum/brand.enum';
import { ServiceError } from '@app/common/exception/service.error';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';

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
}
