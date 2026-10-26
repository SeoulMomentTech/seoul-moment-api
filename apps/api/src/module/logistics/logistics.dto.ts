import { CvsChain } from '@app/repository/enum/order.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

/** 전자지도에서 고른 매장. 서버가 Redis 에 잠시 보관했다가 주문 생성 때 꺼내 쓴다 */
export class GetCvsStoreResponse {
  @ApiProperty({
    description:
      '주문 생성(cvsPickup.storeToken) · 미리보기(cvsStoreToken)에 그대로 넘긴다. 1시간 유효',
    example: '3f9c1a7b2e4d6f8a0b1c',
  })
  storeToken: string;

  @ApiProperty({ enum: CvsChain, example: CvsChain.UNIMART })
  chain: CvsChain;

  @ApiProperty({
    description: 'ECPay LogisticsSubType',
    example: 'UNIMARTC2C',
  })
  logisticsSubType: string;

  @ApiProperty({ description: '매장 ID', example: '131386' })
  storeId: string;

  @ApiProperty({ description: '매장명', example: '建盛門市' })
  storeName: string;

  @ApiProperty({
    description: '매장 주소',
    example: '台北市中正區重慶南路一段122號',
  })
  storeAddress: string;

  @ApiPropertyOptional({
    description: '매장 전화. 7-ELEVEN 은 ECPay 가 주지 않는다',
    nullable: true,
  })
  storeTelephone: string | null;

  @ApiProperty({
    description:
      '離島(澎湖·金門·馬祖 등) 매장이면 true — 외섬 배송비가 붙는다. Hi-Life 는 ECPay 가 알려주지 않아 항상 false',
    example: false,
  })
  isOutsideIsland: boolean;

  static of(fields: GetCvsStoreResponse): GetCvsStoreResponse {
    return plainToInstance(this, fields);
  }
}

/** Redis 에 넣는 전자지도 요청 상태 */
export interface CvsMapState {
  chain: CvsChain;
  logisticsSubType: string;
  returnUrl: string | null;
}
