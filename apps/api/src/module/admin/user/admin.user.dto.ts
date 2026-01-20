import { AdminEntity } from '@app/repository/entity/admin.entity';
import { AdminStatus } from '@app/repository/enum/admin.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class AdminUserRequest extends ListFilterDto {}

export class AdminUserResponse {
  @ApiProperty({
    description: 'ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '이메일',
    example: 'test@test.com',
  })
  email: string;

  @ApiProperty({
    description: '이름',
  })
  name: string;

  @ApiProperty({
    description: '역할',
    example: 'admin',
  })
  role: string;

  @ApiProperty({
    description: '상태',
    example: AdminStatus.NORMAL,
    enum: AdminStatus,
  })
  @IsEnum(AdminStatus)
  status: AdminStatus;

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(entity: AdminEntity): AdminUserResponse {
    return plainToInstance(AdminUserResponse, {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      role: entity.role.name,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}
