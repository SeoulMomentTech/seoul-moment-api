import { HttpRequestModule } from '@app/http/http.module';
import { Module } from '@nestjs/common';

import { SerperService } from './serper.service';

@Module({
  imports: [HttpRequestModule],
  providers: [SerperService],
  exports: [SerperService],
})
export class SerperModule {}
