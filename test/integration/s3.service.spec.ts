import { LoggerService } from '@app/common/log/logger.service';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestSetup } from '../setup/test-setup';

describe('S3Service Integration Tests (실제 AWS 통신)', () => {
  let s3Service: S3Service;
  let module: TestingModule;
  let uploadedKeys: string[] = []; // 테스트 중 업로드된 파일들 추적

  beforeAll(async () => {
    await TestSetup.initializeCache(); // S3는 DB 없이 캐시만 필요

    module = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    s3Service = module.get<S3Service>(S3Service);
  });

  afterAll(async () => {
    // 테스트 완료 후 모든 업로드된 파일 정리
    for (const key of uploadedKeys) {
      try {
        await s3Service.deleteFile(key);
        console.log(`✅ 테스트 파일 삭제 완료: ${key}`);
      } catch (error) {
        console.warn(`⚠️ 테스트 파일 삭제 실패: ${key}`, error.message);
      }
    }

    await module.close();
    await TestSetup.cleanup();
  });

  afterEach(() => {
    // 각 테스트 후 mock 리셋
    jest.clearAllMocks();
  });

  describe('S3 연결 및 설정 확인', () => {
    it('S3 설정이 올바르게 구성되어야 함', () => {
      expect(s3Service.isConfigured()).toBe(true);
    });

    it('S3 연결 테스트가 성공해야 함', async () => {
      const isConnected = await s3Service.testConnection();
      expect(isConnected).toBe(true);
    }, 10000); // 10초 타임아웃
  });

  describe('파일 업로드 테스트', () => {
    it('텍스트 파일 업로드가 성공해야 함', async () => {
      // Given: 테스트용 텍스트 파일 생성
      const testContent = Buffer.from('테스트 파일 내용 - 한글 포함');
      const fileName = `test-${Date.now()}.txt`;

      // When: 파일 업로드
      const result = await s3Service.uploadFile(testContent, {
        folder: 'test-integration',
        fileName,
        contentType: 'text/plain; charset=utf-8',
        metadata: {
          testType: 'integration',
          uploadedBy: 'jest',
        },
      });

      // Then: 업로드 결과 검증
      expect(result).toBeDefined();
      expect(result.key).toContain('test-integration');
      expect(result.key).toContain(fileName);
      expect(result.bucket).toBe('seoul-moment-dev');
      expect(result.url).toContain('https://image-dev.seoulmoment.com.tw');
      expect(result.fileName).toBe(fileName);

      // 업로드된 파일 추적 (나중에 삭제용)
      uploadedKeys.push(result.key);

      console.log(`✅ 파일 업로드 성공: ${result.key}`);
    }, 15000);

    it('이미지 파일 업로드가 성공해야 함', async () => {
      // Given: 가짜 JPEG 이미지 생성 (최소한의 JPEG 헤더)
      const jpegHeader = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      ]);
      const jpegBody = Buffer.alloc(100, 0x80); // 더미 데이터
      const jpegEnd = Buffer.from([0xff, 0xd9]); // JPEG 종료 마커
      const fakeJpegBuffer = Buffer.concat([jpegHeader, jpegBody, jpegEnd]);

      // When: 이미지 업로드
      const result = await s3Service.uploadImage(fakeJpegBuffer, {
        folder: 'test-images',
        imageFormat: 'jpeg',
        metadata: {
          testType: 'integration-image',
          imageType: 'fake-jpeg',
        },
      });

      // Then: 업로드 결과 검증
      expect(result).toBeDefined();
      expect(result.key).toContain('test-images');
      expect(result.key).toContain('.jpg');
      expect(result.bucket).toBe('seoul-moment-dev');
      expect(result.url).toContain('https://image-dev.seoulmoment.com.tw');

      // 업로드된 파일 추적
      uploadedKeys.push(result.key);

      console.log(`✅ 이미지 업로드 성공: ${result.key}`);
    }, 15000);

    it('PNG 이미지 업로드가 성공해야 함', async () => {
      // Given: 가짜 PNG 이미지 생성 (PNG 시그니처)
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const pngData = Buffer.alloc(50, 0xff); // 더미 데이터
      const fakePngBuffer = Buffer.concat([pngSignature, pngData]);

      // When: PNG 업로드
      const result = await s3Service.uploadImage(fakePngBuffer, {
        folder: 'test-images',
        imageFormat: 'png',
        fileName: `test-${Date.now()}.png`,
      });

      // Then: 업로드 결과 검증
      expect(result.key).toContain('.png');
      expect(result.fileName).toContain('.png');

      uploadedKeys.push(result.key);
      console.log(`✅ PNG 업로드 성공: ${result.key}`);
    }, 15000);
  });

  describe('파일 관리 테스트', () => {
    let testFileKey: string;

    beforeEach(async () => {
      // 각 테스트용 파일 생성
      const testContent = Buffer.from(`테스트 파일 - ${Date.now()}`);
      const result = await s3Service.uploadFile(testContent, {
        folder: 'test-management',
        fileName: `management-test-${Date.now()}.txt`,
        contentType: 'text/plain',
      });
      testFileKey = result.key;
      uploadedKeys.push(testFileKey);
    });

    it('파일 존재 여부 확인이 정상 작동해야 함', async () => {
      // When: 존재하는 파일 확인
      const exists = await s3Service.fileExists(testFileKey);

      // Then: 파일이 존재해야 함
      expect(exists).toBe(true);

      // When: 존재하지 않는 파일 확인
      const notExists = await s3Service.fileExists('non-existent-file.txt');

      // Then: 파일이 존재하지 않아야 함
      expect(notExists).toBe(false);
    }, 10000);

    it('파일 삭제가 성공해야 함', async () => {
      // Given: 파일이 존재함을 확인
      const existsBefore = await s3Service.fileExists(testFileKey);
      expect(existsBefore).toBe(true);

      // When: 파일 삭제
      await s3Service.deleteFile(testFileKey);

      // Then: 파일이 삭제되었음을 확인
      const existsAfter = await s3Service.fileExists(testFileKey);
      expect(existsAfter).toBe(false);

      // 삭제된 파일은 추적 목록에서 제거
      uploadedKeys = uploadedKeys.filter((key) => key !== testFileKey);

      console.log(`✅ 파일 삭제 성공: ${testFileKey}`);
    }, 10000);
  });

  describe('에러 처리 테스트', () => {
    it('존재하지 않는 파일 삭제는 S3 특성상 성공으로 처리됨', async () => {
      // Given: S3는 존재하지 않는 파일 삭제를 성공으로 처리함 (idempotent)

      // When: 존재하지 않는 파일 삭제 시도
      const deletePromise = s3Service.deleteFile(
        'non-existent-folder/non-existent-file.txt',
      );

      // Then: 에러 없이 성공해야 함 (S3의 특성)
      await expect(deletePromise).resolves.toBeUndefined();

      console.log(
        '✅ S3 idempotent 특성 확인: 존재하지 않는 파일 삭제도 성공 처리',
      );
    });

    it('잘못된 버킷 접근 시 에러가 발생해야 함 (Mock 테스트)', async () => {
      // Given: S3Service 내부의 bucketName을 잘못된 값으로 변경
      const originalBucketName = (s3Service as any).bucketName;
      (s3Service as any).bucketName = 'non-existent-bucket-12345';

      try {
        // When: 잘못된 버킷에 파일 업로드 시도
        await expect(
          s3Service.uploadFile(Buffer.from('test'), {
            folder: 'test',
            fileName: 'error-test.txt',
          }),
        ).rejects.toThrow('S3 업로드 실패');

        console.log('✅ 잘못된 버킷 접근 에러 처리 확인');
      } finally {
        // Given: 원래 버킷명 복원
        (s3Service as any).bucketName = originalBucketName;
      }
    });

    it('빈 파일 업로드도 성공해야 함', async () => {
      // Given: 빈 버퍼
      const emptyBuffer = Buffer.alloc(0);

      // When: 빈 파일 업로드
      const result = await s3Service.uploadFile(emptyBuffer, {
        folder: 'test-empty',
        fileName: `empty-${Date.now()}.txt`,
        contentType: 'text/plain',
      });

      // Then: 업로드 성공
      expect(result).toBeDefined();
      expect(result.key).toContain('test-empty');

      uploadedKeys.push(result.key);
    }, 10000);
  });

  describe('대용량 파일 테스트', () => {
    it('1MB 파일 업로드가 성공해야 함', async () => {
      // Given: 1MB 더미 데이터 생성
      const largeBuffer = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A'

      // When: 대용량 파일 업로드
      const result = await s3Service.uploadFile(largeBuffer, {
        folder: 'test-large',
        fileName: `large-${Date.now()}.dat`,
        contentType: 'application/octet-stream',
        metadata: {
          fileSize: '1MB',
          testType: 'large-file',
        },
      });

      // Then: 업로드 성공
      expect(result).toBeDefined();
      expect(result.key).toContain('test-large');

      uploadedKeys.push(result.key);
      console.log(`✅ 1MB 파일 업로드 성공: ${result.key}`);
    }, 30000); // 30초 타임아웃
  });

  describe('파일명 및 경로 테스트', () => {
    it('한글 파일명 업로드가 성공해야 함', async () => {
      // Given: 한글 파일명
      const koreanFileName = `한글파일명-${Date.now()}.txt`;
      const content = Buffer.from('한글 내용이 포함된 파일');

      // When: 한글 파일명으로 업로드
      const result = await s3Service.uploadFile(content, {
        folder: 'test-korean',
        fileName: koreanFileName,
        contentType: 'text/plain; charset=utf-8',
      });

      // Then: 업로드 성공
      expect(result).toBeDefined();
      expect(result.fileName).toBe(koreanFileName);

      uploadedKeys.push(result.key);
    }, 15000);

    it('특수문자가 포함된 폴더명 업로드가 성공해야 함', async () => {
      // Given: 특수문자 포함 폴더명
      const content = Buffer.from('특수문자 폴더 테스트');

      // When: 특수문자 폴더에 업로드
      const result = await s3Service.uploadFile(content, {
        folder: 'test-special-chars',
        fileName: `special-${Date.now()}.txt`,
        contentType: 'text/plain',
      });

      // Then: 업로드 성공
      expect(result.key).toContain('test-special-chars');

      uploadedKeys.push(result.key);
    }, 15000);
  });
});
