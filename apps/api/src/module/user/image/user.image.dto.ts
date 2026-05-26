import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import { UserS3ImageFolder } from './user.image.enum';

export class UserUploadImageRequest {
  @ApiProperty({
    description: '이미지',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
  })
  @IsString()
  @IsDefined()
  base64: string;

  @ApiProperty({
    description: '폴더',
    example: UserS3ImageFolder.PROFILE,
    enum: UserS3ImageFolder,
  })
  @IsEnum(UserS3ImageFolder)
  @IsDefined()
  folder: UserS3ImageFolder;
}

export class UserUploadFileRequest {
  @ApiPropertyOptional({
    description: '파일 업로드 필드 (다중 파일 지원)',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsArray()
  @IsOptional()
  file: Express.Multer.File[];

  @ApiProperty({
    description: '폴더',
    example: UserS3ImageFolder.PROFILE,
    enum: UserS3ImageFolder,
  })
  @IsEnum(UserS3ImageFolder)
  @IsDefined()
  folder: UserS3ImageFolder;
}

export class UserUploadImageResponse {
  @ApiProperty({
    description: '이미지 URL',
    example:
      'https://example.com/profile/2025-09-16/seoul-moment-profile-01.webp',
  })
  imageUrl: string;

  @ApiProperty({
    description: '이미지 경로',
    example: '/profile/2025-09-16/seoul-moment-profile-01.webp',
  })
  imagePath: string;
}
