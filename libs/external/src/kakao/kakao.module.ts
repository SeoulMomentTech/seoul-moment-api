import { HttpRequestModule } from '@app/http/http.module';
import { Module } from '@nestjs/common';

import { KakaoService } from './kakao.service';

@Module({
  imports: [HttpRequestModule],
  providers: [KakaoService],
  exports: [KakaoService],
})
export class KakaoModule {}
