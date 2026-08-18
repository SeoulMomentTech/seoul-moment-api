import { HttpRequestModule } from '@app/http/http.module';
import { Module } from '@nestjs/common';

import { ExternalLineAuthService } from './line-auth.service';

@Module({
  imports: [HttpRequestModule],
  providers: [ExternalLineAuthService],
  exports: [ExternalLineAuthService],
})
export class ExternalLineModule {}
