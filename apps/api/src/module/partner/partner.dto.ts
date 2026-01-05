import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { PartnerCategoryEntity } from '@app/repository/entity/partner-category.entity';
import { PartnerEntity } from '@app/repository/entity/partner.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber } from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetPartnerRequest {
  @ApiProperty({
    description: '협력사 카테고리 아이디',
    example: 1,
  })
  @IsDefined()
  @IsNumber()
  @Type(() => Number)
  partnerCategoryId: number;
}

export class GetPartnerResponse {
  @ApiProperty({
    description: '협력사 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '협력사 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/partners/2025-09-16/partner-logo.jpg',
  })
  image: string;

  @ApiProperty({
    description: '협력사 제목',
    example: '뷰티 파트너',
  })
  title: string;

  @ApiProperty({
    description: '협력사 설명',
    example: '고품질 뷰티 제품을 제공하는 파트너사입니다.',
  })
  description: string;

  @ApiProperty({
    description: '협력사 링크 URL',
    example: 'https://partner.example.com',
  })
  link: string;

  static from(entity: PartnerEntity, multilingual: MultilingualTextEntity[]) {
    multilingual = multilingual.filter((v) => v.entityId === entity.id);

    const title = MultilingualFieldDto.fromByEntity(multilingual, 'title');
    const description = MultilingualFieldDto.fromByEntity(
      multilingual,
      'description',
    );

    return plainToInstance(this, {
      id: entity.id,
      image: entity.getImage(),
      title: title.getContent(),
      description: description.getContent(),
      link: entity.link,
    });
  }
}

export class GetPartnerCategoryResponse {
  @ApiProperty({
    description: '협력사 카테고리 id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '협력사 카테고리 이름',
    example: '뷰티',
  })
  name: string;

  static from(
    entity: PartnerCategoryEntity,
    multilingual: MultilingualTextEntity[],
  ) {
    multilingual = multilingual.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingual, 'name');

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}
