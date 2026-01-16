# Environment Configuration Guide

## 환경별 설정 파일

본 프로젝트는 환경별로 다른 설정을 사용하며, AWS SSM Parameter Store를 통한 보안 설정 관리를 지원합니다.

### 환경 파일 구조

```
├── .env.local         # 로컬 개발 환경
├── .env.development   # 개발 서버 환경
└── .env.production    # 프로덕션 환경
```

### 환경 설정

환경은 `NODE_ENV` 변수로 구분됩니다:

- `local`: 로컬 개발 환경
- `dev`: 개발 서버 환경
- `prod`: 프로덕션 환경

### GitHub Actions를 통한 AWS SSM 연동

프로덕션 및 개발 환경에서는 민감한 정보를 AWS SSM Parameter Store에서 관리하고, GitHub Actions에서 이를 환경변수로 매핑합니다.

#### SSM 파라미터 구조

```
/seoul-moment/{environment}/database/host
/seoul-moment/{environment}/database/username
/seoul-moment/{environment}/database/password (SecureString)
/seoul-moment/{environment}/database/name
/seoul-moment/{environment}/jwt/secret (SecureString)
/seoul-moment/{environment}/slack/webhook (SecureString)
/seoul-moment/{environment}/log/host
/seoul-moment/{environment}/redis/host
```

#### GitHub Actions 워크플로 예시

```yaml
name: Deploy to Development

on:
  push:
    branches: [dev]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2

      - name: Get SSM parameters
        run: |
          echo "DATABASE_PASSWORD=$(aws ssm get-parameter --name "/seoul-moment/dev/database/password" --with-decryption --query "Parameter.Value" --output text)" >> $GITHUB_ENV
          echo "JWT_SECRET=$(aws ssm get-parameter --name "/seoul-moment/dev/jwt/secret" --with-decryption --query "Parameter.Value" --output text)" >> $GITHUB_ENV
          echo "SLACK_WEBHOOK=$(aws ssm get-parameter --name "/seoul-moment/dev/slack/webhook" --with-decryption --query "Parameter.Value" --output text)" >> $GITHUB_ENV

      - name: Deploy application
        run: |
          # 배포 스크립트 실행
          # 환경변수들이 자동으로 주입됨
```

### 환경별 서버 시작

```bash
# 로컬 환경
NODE_ENV=local npm run start:dev

# 개발 환경
NODE_ENV=dev npm run start:dev

# 프로덕션 환경
NODE_ENV=prod npm run start:prod
```

### 서버 시작 로그

서버 시작 시 다음과 같은 환경 정보가 로깅됩니다:

```
🚀 Starting Seoul Moment API Server
📦 Environment: local
🔧 Port: 3000
📊 API Version: v1
🗄️  Database: localhost:5432/seoul_moment_local
📝 Log Level: debug
☁️  AWS Region: ap-northeast-2
🔴 Redis: localhost:6379
✅ Server is running on http://localhost:3000
📚 Environment configuration loaded successfully
```

### 보안 고려사항

1. **민감한 정보는 SSM Parameter Store 사용**
   - 데이터베이스 비밀번호
   - JWT 시크릿
   - API 키 및 웹훅 URL

2. **환경 파일 관리**
   - `.env.*` 파일은 `.gitignore`에 추가
   - 프로덕션 환경에서는 환경변수나 SSM 사용

3. **권한 관리**
   - EC2 인스턴스에는 적절한 IAM 역할 부여
   - SSM 파라미터 접근 권한 최소화
