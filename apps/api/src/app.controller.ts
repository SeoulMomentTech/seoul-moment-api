import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getHello(): Record<string, any> {
    return { data: 'hello' };
  }
}
