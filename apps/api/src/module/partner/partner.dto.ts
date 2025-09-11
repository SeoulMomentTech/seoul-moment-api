import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { PartnerEntity } from '@app/repository/entity/partner.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber } from 'class-validator';

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

  @ApiProperty({
    description: '협력사 국가',
    example: LanguageCode.CHINESE,
    enum: LanguageCode,
  })
  @IsDefined()
  @IsEnum(LanguageCode)
  country: LanguageCode;
}

export class GetPartnerResponse {
  id: number;
  image: string;
  title: string;
  description: string;
  link: string;
  country: LanguageCode;

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
      country: entity.country,
    });
  }
}
