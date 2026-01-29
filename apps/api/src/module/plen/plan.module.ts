import { Module } from '@nestjs/common';

import { PlenHelloController } from './plan.controller';

@Module({
  imports: [],
  controllers: [PlenHelloController],
  providers: [],
})
export class PlenModule {}
