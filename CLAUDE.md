# Claude Code 개발 가이드

## 통합 테스트 환경 설정 가이드

### 1. 테스트 환경 구성 원칙

#### PostgreSQL Docker 컨테이너 사용
- **실제 데이터베이스** 사용 (인메모리나 모킹 대신)
- `docker-compose.test.yml`로 테스트 전용 PostgreSQL 컨테이너 구성
- 테스트 격리를 위한 독립적인 데이터베이스 환경

#### 테스트 명령어
```bash
# 전체 통합 테스트 실행 (권장)
npm run test:full

# 단계별 실행
npm run test:db:up        # PostgreSQL 컨테이너 시작
npm run test:integration  # 통합 테스트 실행
npm run test:db:down      # 컨테이너 정리

# 개발 중 유용한 명령어
npm run test:integration:watch  # watch 모드
npm run test:db:logs           # DB 로그 확인
```

### 2. TypeORM 엔티티 설정 원칙

#### 테스트 환경에서 외래키 제약조건 비활성화
```typescript
@ManyToOne(() => ParentEntity, (parent) => parent.children, {
  onDelete: 'CASCADE',
  createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
})
@JoinColumn({ name: 'parent_id' })
parent: ParentEntity;
```

**이유**: 테스트 환경에서 외래키 제약조건이 있으면 `TRUNCATE CASCADE`가 복잡해지고, 데이터 정리 시 순서 의존성 문제가 발생

#### 실제 테이블 이름 확인 필수
TypeORM naming strategy에 의해 엔티티 이름과 실제 테이블 이름이 다를 수 있음:
- `BrandEntity` → `brand` 테이블
- `BrandBannerImageEntity` → `brand_banner_image` 테이블
- `BrandSectionEntity` → `brand_section` 테이블 (brand_info_sections가 아님)

### 3. 테스트 데이터베이스 정리 전략

#### TestSetup 클래스의 clearDatabase() 메서드
```typescript
static async clearDatabase(): Promise<void> {
  // 실제 테이블 이름 사용 (엔티티 이름과 다름)
  const tables = ['brand', 'brand_banner_image', 'brand_section', 'brand_section_image'];
  
  for (const tableName of tables) {
    const exists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      );
    `);
    
    if (exists[0].exists) {
      // RESTART IDENTITY로 시퀀스도 초기화
      await this.dataSource.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY`);
    }
  }
}
```

#### Jest 설정에서 정리 타이밍
```typescript
// beforeAll: 초기 정리
beforeAll(async () => {
  await TestSetup.initialize();
  await TestSetup.clearDatabase(); // 초기화 완료 후 정리
});

// afterEach: 각 테스트 후 정리 (테스트 격리)
afterEach(async () => {
  await TestSetup.clearDatabase();
});
```

### 4. 테스트 작성 시 주의사항

#### ServiceError 테스트
```typescript
// ❌ 잘못된 방법
expect(error.errorCode).toBe(ServiceErrorCode.NOT_FOUND_DATA);

// ✅ 올바른 방법
expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
```

#### Eager Loading 정렬 문제
TypeORM의 eager loading은 정렬을 보장하지 않음:
```typescript
// 테스트에서 수동 정렬 후 검증
const sortedBanners = brand.brandBannerImageList.sort((a, b) => a.sortOrder - b.sortOrder);
expect(sortedBanners[0].sortOrder).toBe(1);
```

#### 테스트 데이터 팩토리 활용
```typescript
// 복잡한 관계 데이터 생성
const brand = await testDataFactory.createFullBrand({
  brand: { name: 'Test Brand', status: BrandStatus.NORMAL },
  banners: [
    { sortOrder: 1, imageUrl: 'banner1.jpg' },
    { sortOrder: 2, imageUrl: 'banner2.jpg' }
  ],
  sections: [
    {
      title: 'Section 1',
      sortOrder: 1,
      images: [
        { sortOrder: 1, imageUrl: 'section1-1.jpg' }
      ]
    }
  ]
});
```

### 5. 환경 변수 설정

#### .env.test 파일
```env
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=seoul_moment_test
```

#### TypeORM 테스트 설정
```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [/* 엔티티 목록 */],
  synchronize: true,    // 테스트용으로만 true
  dropSchema: false,    // 스키마 유지, 데이터만 정리
  logging: false,       // 테스트 시 로깅 비활성화
})
```

### 6. 테스트 디버깅 팁

#### 테스트 실패 시 체크리스트
1. **Docker 컨테이너 상태 확인**: `docker ps`
2. **테스트 DB 로그 확인**: `npm run test:db:logs`
3. **실제 테이블 이름 확인**: PostgreSQL에 접속해서 `\dt` 명령
4. **포트 충돌 해결**: `npm run test:db:down && npm run test:db:up`
5. **완전 초기화**: Docker 볼륨까지 삭제 후 재시작

#### 단일 테스트 실행
```bash
npm run test:integration -- --testNamePattern="특정 테스트 이름"
```

### 7. 성능 최적화

#### 테스트 실행 시간 단축
- Docker 컨테이너는 가능한 한 번만 시작/종료
- `npm run test:full` 사용으로 자동화
- `test:integration:watch` 모드로 개발 시 빠른 피드백

#### 메모리 사용량 관리
- 각 테스트 후 완전한 데이터 정리
- `RESTART IDENTITY`로 시퀀스 초기화
- 테스트 간 데이터 누적 방지

### 8. 에러 해결 가이드

#### 자주 발생하는 에러와 해결책

**"relation does not exist" 에러**
→ 테이블 이름 확인, TypeORM naming strategy 고려

**"Empty criteria are not allowed for the delete method" 에러**
→ `repository.delete({})` 대신 `TRUNCATE` 사용

**"permission denied to set parameter" 에러**
→ PostgreSQL 권한 문제, 간단한 TRUNCATE 방식 사용

**외래키 제약조건 에러**
→ `createForeignKeyConstraints: process.env.NODE_ENV !== 'test'` 설정

### 9. 코드 품질 관리

#### 테스트 작성 원칙
- 각 테스트는 독립적이어야 함
- Given-When-Then 패턴 사용
- 의미있는 테스트 이름 작성
- 복잡한 시나리오는 여러 테스트로 분할

#### 테스트 커버리지
```bash
npm run test:cov  # 단위 테스트 커버리지
```

---

## 참고사항

- 이 프로젝트는 실제 PostgreSQL을 사용한 통합 테스트 환경을 구축했습니다
- 모든 테스트는 격리된 상태로 실행되며, 13개 테스트 모두 통과합니다
- 새로운 테스트 작성 시 위 가이드를 참고하여 안정적인 테스트 코드를 작성하세요