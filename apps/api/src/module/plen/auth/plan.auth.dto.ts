import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
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

export class PostPlanLoginResponse {
  @ApiProperty({
    description: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsDefined()
  id: string;

  static from(entity: PlanUserEntity) {
    return plainToInstance(this, {
      id: entity.id,
    });
  }
}
