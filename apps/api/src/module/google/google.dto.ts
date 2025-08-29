import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class PostGoogleEmailRequest {
  @ApiProperty({
    description: '이메일',
    example: 'to@gmail.com',
  })
  @IsEmail()
  @IsDefined()
  to: string;

  @ApiProperty({
    description: '제목',
    example: '문희 드립니다 나 문희',
  })
  @IsString()
  @IsDefined()
  subject: string;

  @ApiProperty({
    description: '이름',
    example: '세리프',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '내용 (HTML 포멧)',
    example: '<body>이 회사에 지원하고 싶습니다!!</body>',
  })
  @IsString()
  @IsOptional()
  html: string;

  @ApiPropertyOptional({
    description: '참조 이메일 리스트',
    example: [[1, 2, 3].map((v) => `cc_${v}@gmail.com`)],
    required: false,
  })
  @IsArray()
  @IsOptional()
  cc?: string[];
}
