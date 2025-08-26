import { TestSetup } from './test-setup';

// 테스트 환경 설정
beforeAll(async () => {
  await TestSetup.initialize();
  // 초기화 완료 후 한 번 정리하여 깨끗한 상태 보장
  await TestSetup.clearDatabase();
});

// 각 테스트 후 데이터베이스 정리 (테스트 격리 보장)
afterEach(async () => {
  await TestSetup.clearDatabase();
});

// 모든 테스트 완료 후 정리
afterAll(async () => {
  await TestSetup.cleanup();
});