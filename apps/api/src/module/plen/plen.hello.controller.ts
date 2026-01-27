import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Plen')
@Controller('hello')
export class PlenHelloController {
  @Get()
  @ApiOperation({ summary: 'Hello' })
  getHello(): { message: string } {
    return { message: 'Hello' };
  }
}
