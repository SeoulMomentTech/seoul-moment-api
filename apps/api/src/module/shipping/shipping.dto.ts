import { ShippingPolicyEntity } from '@app/repository/entity/shipping-policy.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

export class GetShippingPolicyResponse {
  @ApiProperty({ description: '본섬 배송비', example: 60 })
  baseFee: number;

  @ApiProperty({
    description:
      '외섬 정상 배송비. 프로모션 중이면 실제로는 baseFee 가 적용된다',
    example: 100,
  })
  remoteIslandFee: number;

  @ApiProperty({
    description: '외섬 프로모션 여부. true 면 외섬에도 baseFee 가 적용된다',
    example: true,
  })
  remoteIslandPromotion: boolean;

  @ApiProperty({
    description: '무료배송 임계금액. 본섬·외섬 구분 없이 적용된다',
    example: 1150,
  })
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
