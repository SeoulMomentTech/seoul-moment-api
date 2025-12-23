import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OptionUiType } from '@app/repository/enum/option.enum';
import { OptionType } from '@app/repository/enum/product.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsString,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';

import { ListFilterDto } from '../../admin.dto';

export class GetAdminProductOptionRequest extends ListFilterDto {}

export class GetAdminProductOptionNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '옵션 이름',
    example: '크기',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class GetAdminProductOptionResponse {
  @ApiProperty({
    description: '옵션 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션 타입',
    example: OptionType.SIZE,
    enum: OptionType,
  })
  type: OptionType;

  @ApiProperty({
    description: '옵션 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '크기',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Size',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '尺寸',
      },
    ],
    type: [GetAdminProductOptionNameDto],
  })
  nameDto: GetAdminProductOptionNameDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  @ApiProperty({
    description: '옵션 활성 여부',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '옵션 UI 타입',
    example: OptionUiType.RADIO,
    enum: OptionUiType,
  })
  uiType: OptionUiType;

  static from(entity: OptionEntity, nameDto: GetAdminProductOptionNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      type: entity.type,
      nameDto,
      isActive: entity.isActive,
      uiType: entity.uiType,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PostAdminProductOptionText {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '카테고리 이름',
    example: '상의',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class PostAdminProductOptionRequest {
  @ApiProperty({
    description: '국가별 글자',
    type: [PostAdminProductOptionText],
    example: [
      {
        languageId: 1,
        name: '색상',
      },
      {
        languageId: 2,
        name: 'Color',
      },
      {
        languageId: 3,
        name: '颜色',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductOptionText)
  @IsDefined()
  text: PostAdminProductOptionText[];

  @ApiProperty({
    description: '옵션 타입',
    example: OptionType.COLOR,
    enum: OptionType,
  })
  @IsEnum(OptionType)
  @IsDefined()
  type: OptionType;

  @ApiProperty({
    description: '옵션 타입',
    example: OptionUiType.GRID,
    enum: OptionUiType,
  })
  @IsEnum(OptionUiType)
  @IsDefined()
  uiType: OptionUiType;
}

export class PostAdminProductOptionValueText {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '옵션 값 이름',
    example: '빨강',
  })
  @IsString()
  @IsDefined()
  value: string;
}

export class PostAdminProductOptionValueRequest {
  @ApiProperty({
    description: '옵션 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  optionId: number;

  @ApiProperty({
    description: '옵션 값 이름 리스트',
    type: [PostAdminProductOptionValueText],
    example: [
      {
        languageId: 1,
        value: '빨강',
      },
      {
        languageId: 2,
        value: 'Red',
      },
      {
        languageId: 3,
        value: '红色',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductOptionValueText)
  @IsDefined()
  text: PostAdminProductOptionValueText[];
}

export class PatchAdminProductOptionValueRequest {
  @ApiPropertyOptional({
    description: '옵션 ID',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  optionId?: number;

  @ApiPropertyOptional({
    description: '옵션 값 이름 리스트',
    type: [PostAdminProductOptionValueText],
    example: [
      {
        languageId: 1,
        value: '빨강',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductOptionValueText)
  @IsOptional()
  text?: PostAdminProductOptionValueText[];
}

export class PatchAdminProductOptionRequest {
  @ApiPropertyOptional({
    description: '국가별 글자',
    type: [PostAdminProductOptionText],
    example: [
      {
        languageId: 1,
        name: '색상',
      },
      {
        languageId: 2,
        name: 'Color',
      },
      {
        languageId: 3,
        name: '颜色',
      },
    ],
  })
  @IsArray()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductOptionText)
  @IsOptional()
  text?: PostAdminProductOptionText[];

  @ApiPropertyOptional({
    description: '옵션 타입',
    example: OptionType.COLOR,
    enum: OptionType,
  })
  @IsEnum(OptionType)
  @IsOptional()
  type?: OptionType;

  @ApiPropertyOptional({
    description: '옵션 타입',
    example: OptionUiType.GRID,
    enum: OptionUiType,
  })
  @IsEnum(OptionUiType)
  @IsOptional()
  uiType?: OptionUiType;

  @ApiPropertyOptional({
    description: '옵션 활성 여부',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GetAdminProductOptionValueNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '옵션 값',
    example: '빨강',
  })
  value: string;

  static from(languageCode: LanguageCode, value: string) {
    return plainToInstance(this, {
      languageCode,
      value,
    });
  }
}

export class GetAdminProductOptionValueResponse {
  @ApiProperty({
    description: '옵션 값 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션 값 이름 리스트',
    type: [GetAdminProductOptionValueNameDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '빨강',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Red',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '紅色',
      },
    ],
  })
  nameDto: GetAdminProductOptionValueNameDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(
    entity: OptionValueEntity,
    nameDto: GetAdminProductOptionValueNameDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class GetAdminProductOptionInfoResponse {
  @ApiProperty({
    description: '옵션 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션 타입',
    example: OptionType.SIZE,
    enum: OptionType,
  })
  type: OptionType;

  @ApiProperty({
    description: '옵션 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '크기',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Size',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '尺寸',
      },
    ],
    type: [GetAdminProductOptionNameDto],
  })
  nameDto: GetAdminProductOptionNameDto[];

  @ApiProperty({
    description: '옵션 활성 여부',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '옵션 UI 타입',
    example: OptionUiType.RADIO,
    enum: OptionUiType,
  })
  uiType: OptionUiType;

  @ApiProperty({
    description: '옵션 값 리스트',
    type: [GetAdminProductOptionValueResponse],
    example: [
      {
        id: 1,
        nameDto: [
          {
            languageCode: LanguageCode.KOREAN,
            name: '빨강',
          },
          {
            languageCode: LanguageCode.ENGLISH,
            name: 'Red',
          },
          {
            languageCode: LanguageCode.TAIWAN,
            name: '紅色',
          },
        ],
      },
      {
        id: 2,
        nameDto: [
          {
            languageCode: LanguageCode.KOREAN,
            name: '파랑',
          },
          {
            languageCode: LanguageCode.ENGLISH,
            name: 'Blue',
          },
          {
            languageCode: LanguageCode.TAIWAN,
            name: '藍色',
          },
        ],
      },
    ],
  })
  optionValueList: GetAdminProductOptionValueResponse[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(
    entity: OptionEntity,
    nameDto: GetAdminProductOptionNameDto[],
    optionValueList: GetAdminProductOptionValueResponse[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      type: entity.type,
      nameDto,
      isActive: entity.isActive,
      uiType: entity.uiType,
      optionValueList,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}
