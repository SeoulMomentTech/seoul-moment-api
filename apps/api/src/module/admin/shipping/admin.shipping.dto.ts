import { ShippingPolicyEntity } from '@app/repository/entity/shipping-policy.entity';
import { ShippingRemoteAreaEntity } from '@app/repository/entity/shipping-remote-area.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class GetAdminShippingPolicyResponse {
  @ApiProperty({ description: '본섬 배송비', example: 60 })
  baseFee: number;

  @ApiProperty({ description: '외섬 정상 배송비', example: 100 })
  remoteIslandFee: number;

  @ApiProperty({
    description: '외섬 프로모션 여부. true 면 외섬에도 baseFee 를 적용한다',
    example: true,
  })
  remoteIslandPromotion: boolean;

  @ApiProperty({ description: '무료배송 임계금액', example: 1150 })
  freeShippingThreshold: number;

  static from(entity: ShippingPolicyEntity) {
    return plainToInstance(this, {
      baseFee: entity.baseFee,
      remoteIslandFee: entity.remoteIslandFee,
      remoteIslandPromotion: entity.remoteIslandPromotion,
      freeShippingThreshold: entity.freeShippingThreshold,
    });
  }
}

export class PatchAdminShippingPolicyRequest {
  @ApiPropertyOptional({ description: '본섬 배송비', example: 60 })
  @IsInt()
  @Min(0)
  @IsOptional()
  baseFee?: number;

  @ApiPropertyOptional({
    description: '외섬 정상 배송비. 프로모션가로 덮어쓰지 말 것',
    example: 100,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  remoteIslandFee?: number;

  @ApiPropertyOptional({
    description: '외섬 프로모션 종료는 이 값을 false 로 바꾸면 된다',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  remoteIslandPromotion?: boolean;

  @ApiPropertyOptional({
    description: '무료배송 임계금액. 기존 주문 금액에는 영향을 주지 않는다',
    example: 1150,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  freeShippingThreshold?: number;
}

export class GetAdminShippingRemoteAreaResponse {
  @ApiProperty({ description: '외섬 지역 규칙 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '縣市', example: '澎湖縣' })
  city: string;

  @ApiPropertyOptional({
    description: '區/鄉. null 이면 해당 縣 전체가 외섬이다',
    example: null,
  })
  district?: string;

  @ApiProperty({ description: '판정에 사용할지 여부', example: true })
  isActive: boolean;

  static from(entity: ShippingRemoteAreaEntity) {
    return plainToInstance(this, {
      id: entity.id,
      city: entity.city,
      district: entity.district,
      isActive: entity.isActive,
    });
  }
}

export class PostAdminShippingRemoteAreaRequest {
  @ApiProperty({ description: '縣市', example: '澎湖縣' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  city: string;

  @ApiPropertyOptional({
    description:
      '區/鄉. 생략하면 해당 縣 전체가 외섬이 된다. 綠島鄉·蘭嶼鄉 처럼 縣 일부만 외섬일 때 지정한다',
    example: '綠島鄉',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  district?: string;

  @ApiPropertyOptional({ description: '판정 사용 여부', example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
