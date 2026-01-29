import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsString } from 'class-validator';

export class PostPlanLoginRequest {
  @ApiProperty({
    description: '아이디',
    example: '1234567890',
  })
  @IsString()
  @IsDefined()
  id: string;

  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  @IsEmail()
  @IsDefined()
  email: string;
}
