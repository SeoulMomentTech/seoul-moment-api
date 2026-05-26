import { S3Service } from '@app/external/aws/s3/s3.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const IMAGE_BASE = '/user/image';

describe('UserImageController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let s3Service: S3Service;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 + S3Service 인스턴스 보관
    app = await getTestApp();
    dataSource = getDataSource(app);
    s3Service = app.get(S3Service);
  }, 60_000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await truncateTables(dataSource, [
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼: signup → login → oneTimeToken 발급
  // -------------------------------------------------------------------------
  async function signUpAndLogin(): Promise<{ oneTimeToken: string }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20),
    };

    const signupRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/signup`)
      .send(body);
    expect(signupRes.status).toBe(204);

    const loginRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/login`)
      .send({ email: body.email, password: body.password });
    expect(loginRes.status).toBe(200);

    return { oneTimeToken: loginRes.body.data.token as string };
  }

  function mockS3UploadImage(): jest.SpyInstance {
    // Given - S3 실제 호출을 가로채 결정적 응답을 돌려줌
    return jest.spyOn(s3Service, 'uploadImage').mockResolvedValue({
      url: 'https://example.com/profile/2025-05-26/uuid-test.webp',
      key: 'profile/2025-05-26/uuid-test.webp',
      bucket: 'test-bucket',
      fileName: 'uuid-test.webp',
    });
  }

  // 1x1 투명 PNG (base64) — sharp 처리가 굳이 필요 없는 더미값. mock이 가로채므로 내용은 의미 없음.
  const DUMMY_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // -------------------------------------------------------------------------
  // POST /user/image/upload (base64)
  // -------------------------------------------------------------------------
  describe('POST /user/image/upload', () => {
    it('정상 base64 업로드 시 200과 imageUrl/imagePath를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const spy = mockS3UploadImage();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ base64: DUMMY_BASE64, folder: 'profile' });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.imageUrl).toBe(
        'https://example.com/profile/2025-05-26/uuid-test.webp',
      );
      expect(res.body.data.imagePath).toBe(
        '/profile/2025-05-26/uuid-test.webp',
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toEqual({ folder: 'profile' });
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload`)
        .send({ base64: DUMMY_BASE64, folder: 'profile' });

      // Then
      expect(res.status).toBe(401);
    });

    it('base64가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ folder: 'profile' });

      // Then
      expect(res.status).toBe(400);
    });

    it('folder가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ base64: DUMMY_BASE64 });

      // Then
      expect(res.status).toBe(400);
    });

    it('folder가 UserS3ImageFolder enum 값이 아니면 400을 반환한다 (admin 폴더 차단)', async () => {
      // Given - admin 전용 폴더 값을 흉내낸 문자열
      const { oneTimeToken } = await signUpAndLogin();
      const spy = mockS3UploadImage();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ base64: DUMMY_BASE64, folder: 'home' });

      // Then - enum 검증으로 차단되어 S3 호출이 일어나지 않아야 한다
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/image/upload/file (multipart)
  // -------------------------------------------------------------------------
  describe('POST /user/image/upload/file', () => {
    it('정상 파일 업로드 시 200과 imageUrl/imagePath를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const spy = mockS3UploadImage();
      const fileBuffer = Buffer.from('fake-image-bytes');

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload/file`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .field('folder', 'profile')
        .attach('file', fileBuffer, {
          filename: 'profile.png',
          contentType: 'image/png',
        });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.imageUrl).toBe(
        'https://example.com/profile/2025-05-26/uuid-test.webp',
      );
      expect(res.body.data.imagePath).toBe(
        '/profile/2025-05-26/uuid-test.webp',
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toEqual({ folder: 'profile' });
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload/file`)
        .field('folder', 'profile')
        .attach('file', Buffer.from('x'), 'profile.png');

      // Then
      expect(res.status).toBe(401);
    });

    it('파일이 첨부되지 않으면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const spy = mockS3UploadImage();

      // When - file 필드 없이 folder만 전송
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload/file`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .field('folder', 'profile');

      // Then
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it('folder가 UserS3ImageFolder enum 값이 아니면 400을 반환한다 (admin 폴더 차단)', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const spy = mockS3UploadImage();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload/file`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .field('folder', 'home')
        .attach('file', Buffer.from('x'), 'x.png');

      // Then
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it('folder가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${IMAGE_BASE}/upload/file`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .attach('file', Buffer.from('x'), 'x.png');

      // Then
      expect(res.status).toBe(400);
    });
  });
});
