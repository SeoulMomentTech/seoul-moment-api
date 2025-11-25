import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString } from 'class-validator';

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

export class AdminUploadImageResponse {
  @ApiProperty({
    description: '이미지 URL',
    example: 'https://example.com/image.jpg',
  })
  imageUrl: string;
}
