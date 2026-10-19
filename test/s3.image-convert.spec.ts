import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import { S3Service, UploadResult } from '@app/external/aws/s3/s3.service';
import sharp from 'sharp';

jest.spyOn(Configuration, 'getConfig').mockReturnValue({
  AWS_S3_BUCKET_NAME: 'test-bucket',
  AWS_ACCESS_KEY_ID: 'test-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret',
  IMAGE_DOMAIN_NAME: 'https://image.seoulmoment.com',
} as any);

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as LoggerService;

// 지정한 크기의 반투명 PNG 버퍼를 만든다
function createPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe('S3Service.uploadImage 포맷 변환 (단위 테스트)', () => {
  let s3Service: S3Service;
  let uploadFileSpy: jest.SpyInstance;

  beforeEach(() => {
    // Given - S3 실제 업로드를 가로채 변환 결과만 확인
    s3Service = new S3Service(logger);
    uploadFileSpy = jest
      .spyOn(s3Service, 'uploadFile')
      .mockResolvedValue({} as UploadResult);
  });

  afterEach(() => {
    uploadFileSpy.mockRestore();
  });

  function getUploaded(): {
    buffer: Buffer;
    fileName: string;
    contentType: string;
  } {
    const [buffer, options] = uploadFileSpy.mock.calls[0];
    return {
      buffer,
      fileName: options.fileName,
      contentType: options.contentType,
    };
  }

  it('일반 크기 이미지는 webp로 업로드한다', async () => {
    // Given
    const png = await createPng(100, 100);

    // When
    await s3Service.uploadImage(png, { folder: 'product' });

    // Then
    const { buffer, fileName, contentType } = getUploaded();
    expect(contentType).toBe('image/webp');
    expect(fileName).toMatch(/\.webp$/);
    expect((await sharp(buffer).metadata()).format).toBe('webp');
  });

  it('한 변이 정확히 16383px이면 webp로 업로드한다', async () => {
    // Given
    const png = await createPng(10, 16383);

    // When
    await s3Service.uploadImage(png, { folder: 'product' });

    // Then
    const { contentType, fileName } = getUploaded();
    expect(contentType).toBe('image/webp');
    expect(fileName).toMatch(/\.webp$/);
  });

  it('한 변이 16383px를 넘는 긴 이미지는 원본 크기 그대로 jpeg로 업로드한다', async () => {
    // Given - 상품 상세처럼 세로로 긴 이미지
    const png = await createPng(20, 16384);

    // When
    await s3Service.uploadImage(png, { folder: 'product' });

    // Then
    const { buffer, fileName, contentType } = getUploaded();
    expect(contentType).toBe('image/jpeg');
    expect(fileName).toMatch(/\.jpg$/);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(20);
    expect(meta.height).toBe(16384);
  });

  it('jpeg로 바꿀 때 투명한 부분은 흰색으로 채운다', async () => {
    // Given - 전부 투명한 긴 이미지
    const png = await createPng(20, 16384);

    // When
    await s3Service.uploadImage(png, { folder: 'product' });

    // Then
    const { buffer } = getUploaded();
    const { data, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    expect(Math.min(...data.subarray(0, 300))).toBeGreaterThanOrEqual(250);
  });

  it('jpeg 한도(65500px)도 넘으면 비율을 유지해 65500px로 줄인다', async () => {
    // Given
    const png = await createPng(4, 70000);

    // When
    await s3Service.uploadImage(png, { folder: 'product' });

    // Then
    const { buffer, contentType } = getUploaded();
    expect(contentType).toBe('image/jpeg');
    const meta = await sharp(buffer).metadata();
    expect(meta.height).toBe(65500);
    expect(meta.width).toBeLessThanOrEqual(4);
  });
});
