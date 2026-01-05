import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDefined, IsOptional, IsString } from 'class-validator';

import { AdminS3ImageFolder } from './admin.image.enum';

export class AdminUploadImageRequest {
  @ApiProperty({
    description: '이미지',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
  })
  @IsString()
  @IsDefined()
  base64: string;

  @ApiProperty({
    description: '폴더',
    example: AdminS3ImageFolder.ARTICLE,
  })
  @IsString()
  @IsDefined()
  folder: AdminS3ImageFolder;
}

export class AdminUploadFileRequest {
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
  file: Express.Multer.File[]; // 파일 업로드를 위한 필드

  @ApiProperty({
    description: '폴더',
    example: AdminS3ImageFolder.ARTICLE,
  })
  @IsString()
  @IsDefined()
  folder: AdminS3ImageFolder;
}

export class AdminUploadImageResponse {
  @ApiProperty({
    description: '이미지 URL',
    example:
      'https://example.com/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: '이미지 경로',
    example: '/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
  })
  imagePath: string;
}
