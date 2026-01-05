# 결제 모듈 gRPC 서버 개발 플랜

## 📋 개요

현재 프로젝트(`seoul-moment-api`)에서 결제 요청이 발생하면, 별도의 gRPC 전용 결제 서버로 요청을 전달하는 마이크로서비스 아키텍처를 구축합니다.

## 🏗️ 아키텍처

```
[User Request]
    ↓
[API Server (apps/api)]
    ↓ (gRPC Client)
[Payment gRPC Server (apps/payment-grpc)]
    ↓
[Payment Processing Logic]
```

## 📁 프로젝트 구조

### 1. 새로운 앱 생성: `apps/payment-grpc`

- gRPC 전용 결제 서버
- 독립적으로 실행 가능한 마이크로서비스

### 2. 새로운 라이브러리 생성: `libs/payment-grpc-client`

- API 서버에서 gRPC 서버를 호출하기 위한 클라이언트 라이브러리
- 재사용 가능한 모듈

### 3. Proto 파일 정의: `proto/payment/`

- gRPC 서비스 정의
- 메시지 타입 정의

## 🔧 구현 단계

### Phase 1: 프로젝트 구조 설정

#### 1.1 의존성 추가

```json
{
  "@nestjs/microservices": "^10.0.0",
  "@grpc/grpc-js": "^1.9.0",
  "@grpc/proto-loader": "^0.7.0",
  "ts-proto": "^1.159.0" // proto 파일을 TypeScript로 컴파일
}
```

#### 1.2 Proto 파일 디렉토리 생성

- `proto/payment/payment.proto` - 결제 서비스 정의

#### 1.3 NestJS 프로젝트 설정

- `nest-cli.json`에 `payment-grpc` 앱 추가
- `tsconfig.json`에 path alias 추가 (`@app/payment-grpc-client`)

### Phase 2: Proto 파일 정의

#### 2.1 결제 서비스 정의

```protobuf
// proto/payment/payment.proto
syntax = "proto3";

package payment;

service PaymentService {
  rpc ProcessPayment (ProcessPaymentRequest) returns (ProcessPaymentResponse);
  rpc GetPaymentStatus (GetPaymentStatusRequest) returns (GetPaymentStatusResponse);
  rpc CancelPayment (CancelPaymentRequest) returns (CancelPaymentResponse);
  rpc RefundPayment (RefundPaymentRequest) returns (RefundPaymentResponse);
}

message ProcessPaymentRequest {
  string order_id = 1;
  int64 amount = 2;
  string currency = 3;
  string payment_method = 4;
  map<string, string> metadata = 5;
}

message ProcessPaymentResponse {
  string payment_id = 1;
  string status = 2;
  string transaction_id = 3;
  int64 timestamp = 4;
}

// ... 기타 메시지 정의
```

### Phase 3: gRPC 서버 구현 (`apps/payment-grpc`)

#### 3.1 디렉토리 구조

```
apps/payment-grpc/
├── src/
│   ├── main.ts                    # gRPC 서버 부트스트랩
│   ├── health.controller.ts       # 헬스체크
│   └── module/
│       └── payment/
│           ├── payment.module.ts
│           ├── payment.controller.ts  # gRPC Controller
│           ├── payment.service.ts     # 비즈니스 로직
│           ├── payment.dto.ts         # DTO 정의
│           └── payment.entity.ts      # 엔티티 (필요시)
```

#### 3.2 주요 구현 사항

- **main.ts**: gRPC 마이크로서비스로 NestJS 앱 생성
- **payment.controller.ts**: Proto에서 정의한 서비스 구현
- **payment.service.ts**: 실제 결제 처리 로직
- **payment.module.ts**: 모듈 설정 및 의존성 주입

#### 3.3 환경 설정

- `apps/payment-grpc/tsconfig.app.json` 생성
- 환경 변수 추가 (gRPC 포트, 결제 게이트웨이 설정 등)

### Phase 4: gRPC 클라이언트 라이브러리 구현 (`libs/payment-grpc-client`)

#### 4.1 디렉토리 구조

```
libs/payment-grpc-client/
├── src/
│   ├── payment-grpc-client.module.ts
│   ├── payment-grpc-client.service.ts
│   ├── payment-grpc-client.dto.ts
│   └── payment-grpc-client.config.ts
└── tsconfig.lib.json
```

#### 4.2 주요 구현 사항

- **payment-grpc-client.service.ts**: gRPC 서버 호출 로직
- **payment-grpc-client.module.ts**: 모듈 정의 (동적 모듈 패턴 사용)
- **payment-grpc-client.config.ts**: 클라이언트 설정 (URL, 타임아웃 등)

### Phase 5: API 서버 통합

#### 5.1 결제 모듈 생성 (`apps/api/src/module/payment/`)

```
apps/api/src/module/payment/
├── payment.module.ts
├── payment.controller.ts    # REST API 엔드포인트
└── payment.service.ts       # PaymentGrpcClientService 사용
```

#### 5.2 통합 흐름

1. 사용자가 REST API로 결제 요청 (`POST /api/payments`)
2. `PaymentController`가 요청 수신
3. `PaymentService`가 `PaymentGrpcClientService`를 통해 gRPC 서버 호출
4. gRPC 서버에서 결제 처리 후 응답 반환
5. REST API로 결과 반환

### Phase 6: 데이터베이스 및 엔티티 (필요시)

#### 6.1 결제 엔티티 생성

- `libs/repository/src/entity/payment.entity.ts`
- `libs/repository/src/service/payment.repository.service.ts`

#### 6.2 결제 상태 관리

- 결제 이력 저장
- 결제 상태 추적
- 트랜잭션 관리

### Phase 7: 에러 처리 및 로깅

#### 7.1 gRPC 에러 처리

- gRPC 상태 코드 매핑
- 커스텀 예외 처리
- 재시도 로직 (필요시)

#### 7.2 로깅

- 기존 `LoggerService` 활용
- gRPC 요청/응답 로깅
- 결제 이벤트 로깅

### Phase 8: 테스트

#### 8.1 단위 테스트

- `payment.service.spec.ts`
- `payment-grpc-client.service.spec.ts`

#### 8.2 통합 테스트

- gRPC 서버 통합 테스트
- API 서버와 gRPC 서버 통합 테스트

#### 8.3 E2E 테스트

- 전체 결제 플로우 테스트

## 📦 패키지 스크립트 추가

### package.json에 추가할 스크립트

```json
{
  "scripts": {
    "build:payment-grpc": "nest build payment-grpc",
    "start:payment-grpc": "nest start payment-grpc",
    "start:payment-grpc:local": "cross-env NODE_ENV=local nest start payment-grpc --watch",
    "start:payment-grpc:dev": "cross-env NODE_ENV=development nest start payment-grpc --watch",
    "start:payment-grpc:prod": "cross-env NODE_ENV=production node dist/apps/payment-grpc/main",
    "proto:generate": "ts-proto --outDir=./libs/payment-grpc-client/src/generated --protoPath=./proto ./proto/**/*.proto"
  }
}
```

## 🔐 보안 고려사항

1. **인증/인가**
   - gRPC 서버 간 통신 인증 (mTLS 또는 API Key)
   - 사용자 인증 토큰 검증

2. **데이터 암호화**
   - 민감한 결제 정보 암호화
   - 전송 중 데이터 암호화 (TLS)

3. **입력 검증**
   - Proto 파일 레벨에서 타입 검증
   - DTO 레벨에서 추가 검증

## 🚀 배포 고려사항

1. **독립 배포**
   - gRPC 서버는 독립적으로 배포 가능
   - API 서버와 별도 스케일링

2. **서비스 디스커버리**
   - gRPC 서버 URL 설정 (환경 변수)
   - 로드 밸런싱 (필요시)

3. **모니터링**
   - gRPC 메트릭 수집
   - 헬스체크 엔드포인트

## 📝 다음 단계

1. ✅ 프로젝트 구조 설정
2. ✅ Proto 파일 정의
3. ✅ gRPC 서버 기본 구현
4. ✅ gRPC 클라이언트 라이브러리 구현
5. ✅ API 서버 통합
6. ✅ 테스트 작성
7. ✅ 문서화

## 🔗 참고 자료

- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [gRPC for Node.js](https://grpc.io/docs/languages/node/)
- [ts-proto](https://github.com/stephenh/ts-proto)

