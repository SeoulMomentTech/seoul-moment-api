import { Module } from '@nestjs/common';

import { PlenHelloController } from './plen.hello.controller';

@Module({
  imports: [],
  controllers: [PlenHelloController],
  providers: [],
})
export class PlenModule {}
