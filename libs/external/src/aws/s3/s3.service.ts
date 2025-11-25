import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  fileName: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

export interface S3UploadOptions {
  folder?: string;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(private readonly logger: LoggerService) {
    this.bucketName = Configuration.getConfig().AWS_S3_BUCKET_NAME;
    this.region = Configuration.getConfig().AWS_REGION;
    this.accessKeyId = Configuration.getConfig().AWS_ACCESS_KEY_ID;
    this.secretAccessKey = Configuration.getConfig().AWS_SECRET_ACCESS_KEY;

    if (!this.bucketName || !this.accessKeyId || !this.secretAccessKey) {
      this.logger.warn(
        'AWS S3 credentials not fully configured. Some features may not work.',
      );
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  /**
   * 파일을 S3에 직접 업로드
   * @param file Buffer 또는 Uint8Array 형태의 파일 데이터
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async uploadFile(
    file: Buffer | Uint8Array,
    options: S3UploadOptions = {},
  ): Promise<UploadResult> {
    const {
      folder = 'uploads',
      fileName,
      contentType = 'application/octet-stream',
      metadata = {},
    } = options;

    const fileKey = this.generateFileKey(folder, fileName);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file,
        ContentType: contentType,
        ACL: 'private',
        Metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'seoul-moment-api',
        },
      });

      await this.s3Client.send(command);

      const url = this.getFileUrl(fileKey);

      this.logger.info(`File uploaded successfully: ${fileKey}`);

      return {
        url,
        key: fileKey,
        bucket: this.bucketName,
        fileName: fileName || fileKey.split('/').pop(),
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new Error(`S3 업로드 실패: ${error.message}`);
    }
  }

  /**
   * 이미지 파일을 S3에 업로드 (항상 webp로 변환)
   * @param imageBufferOrBase64 이미지 버퍼 또는 base64 문자열
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async uploadImage(
    imageBufferOrBase64: Buffer | string,
    options: Omit<S3UploadOptions, 'contentType'> & {
      quality?: number;
    } = {},
  ): Promise<UploadResult> {
    const { folder = 'images', quality = 100, ...restOptions } = options;

    try {
      // base64 문자열인 경우 Buffer로 변환
      let imageBuffer: Buffer;
      if (typeof imageBufferOrBase64 === 'string') {
        // data:image/png;base64, 등의 prefix 제거
        const base64Data = imageBufferOrBase64.replace(
          /^data:image\/[a-z]+;base64,/,
          '',
        );
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = imageBufferOrBase64;
      }

      // 이미지를 webp로 변환
      const convertedBuffer = await sharp(imageBuffer)
        .webp({ quality })
        .toBuffer();

      const fileName = restOptions.fileName || `${uuidv4()}.webp`;

      return this.uploadFile(convertedBuffer, {
        ...restOptions,
        folder,
        fileName,
        contentType: 'image/webp',
      });
    } catch (error) {
      this.logger.error(
        `Failed to convert image to webp: ${error.message}`,
        error.stack,
      );
      throw new Error(`이미지 변환 실패: ${error.message}`);
    }
  }

  /**
   * S3에서 파일 삭제
   * @param key 파일 키
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete file ${key}: ${error.message}`,
        error.stack,
      );
      throw new Error(`S3 삭제 실패: ${error.message}`);
    }
  }

  /**
   * 파일 존재 여부 확인
   * @param key 파일 키
   * @returns 존재 여부
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      this.logger.error(
        `Error checking file existence ${key}: ${error.message}`,
        error.stack,
      );
      throw new Error(`파일 존재 확인 실패: ${error.message}`);
    }
  }

  /**
   * 파일 키 생성
   * @param folder 폴더명
   * @param fileName 파일명 (선택사항)
   * @returns 생성된 파일 키
   */
  private generateFileKey(folder: string, fileName?: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = uuidv4();
    const finalFileName = fileName || uuid;

    return `${folder}/${timestamp}/${uuid}-${finalFileName}`;
  }

  /**
   * 파일 URL 생성 (public 파일용)
   * @param key 파일 키
   * @returns 파일 URL
   */
  private getFileUrl(key: string): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/${key}`;
  }

  /**
   * 이미지 Content-Type 반환
   * @param format 이미지 포맷
   * @returns Content-Type
   */
  private getImageContentType(format: 'jpeg' | 'png' | 'webp' | 'gif'): string {
    const contentTypes = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return contentTypes[format];
  }

  /**
   * 이미지 확장자 반환
   * @param format 이미지 포맷
   * @returns 확장자
   */
  private getImageExtension(format: 'jpeg' | 'png' | 'webp' | 'gif'): string {
    const extensions = {
      jpeg: 'jpg',
      png: 'png',
      webp: 'webp',
      gif: 'gif',
    };
    return extensions[format];
  }

  /**
   * S3 설정 상태 확인
   * @returns 설정 완료 여부
   */
  isConfigured(): boolean {
    return !!(this.bucketName && this.accessKeyId && this.secretAccessKey);
  }

  /**
   * S3 연결 테스트
   * @returns 연결 성공 여부
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('S3 is not configured');
      return false;
    }

    try {
      // 간단한 버킷 접근 테스트
      const testKey = `health-check/${uuidv4()}.txt`;
      const testContent = Buffer.from('health-check');

      await this.uploadFile(testContent, {
        folder: 'health-check',
        fileName: 'test.txt',
        contentType: 'text/plain',
      });

      await this.deleteFile(testKey);

      this.logger.info('S3 connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`S3 connection test failed: ${error.message}`);
      return false;
    }
  }
}
