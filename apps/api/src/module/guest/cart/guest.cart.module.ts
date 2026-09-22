import { CacheModule } from '@app/cache/cache.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { GuestCartController } from './guest.cart.controller';
import { GuestCartService } from './guest.cart.service';
import { UserCartModule } from '../../user/cart/user.cart.module';

/**
 * 심사용 임시 모듈. 심사가 끝나면 이 폴더를 지우고
 * api.module.ts · main.ts 의 참조 두 줄만 빼면 흔적이 남지 않는다.
 * (DB 테이블을 쓰지 않으므로 마이그레이션도 없다)
 */
@Module({
  imports: [
    RepositoryModule,
    CacheModule,
    // 금액·배송비·브랜드 묶음 계산을 회원 장바구니와 공유한다.
    UserCartModule,
  ],
  controllers: [GuestCartController],
  providers: [GuestCartService],
})
export class GuestCartModule {}
