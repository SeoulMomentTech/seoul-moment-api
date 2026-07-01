# Dev 배포 — 알리바바 클라우드 셋업 체크리스트

dev 브랜치 배포를 **AWS EC2 + Jenkins** 에서 **알리바바 ECS + GitHub Actions + ACR** 로 이전하기 위한 콘솔/서버 셋업 순서.

> 목표 구성: **무료 티어 ECS 1대(≈2GB)** 안에 `api + postgres + redis` 컨테이너를 올리고,
> GitHub Actions가 이미지를 빌드해 **ACR**에 push → ECS에 SSH로 `docker compose pull && up`.
> OpenSearch는 dev에서 사용 안 함 (빈 env로 정상 부팅 확인됨).

---

## 0. 사전 결정 사항

| 항목 | 값 (채워 넣기) |
| --- | --- |
| 리전 (Region) | 예: `ap-northeast-2` (서울) 또는 `ap-northeast-1` (도쿄) |
| 인스턴스 사양 | 무료 트라이얼 엔트리 (2vCPU / 2GB 급) |
| OS 이미지 | Ubuntu 22.04 LTS (x86_64) |
| 빌드 플랫폼 | x86 인스턴스 → `linux/amd64` (ARM 인스턴스면 `linux/arm64`) |

---

## 1. ECS 인스턴스 생성 (콘솔)

- [ ] **ECS 콘솔 → 인스턴스 생성**
  - 결제 방식: 무료 트라이얼 / (이후 包年包月 약정 전환 고려)
  - 리전: 위 0번에서 정한 값
  - 인스턴스 사양: 무료 트라이얼 대상 엔트리 (2GB 급)
  - 이미지: **Ubuntu 22.04 LTS**
  - 시스템 디스크: ESSD 40GB
  - 공인 IP: **할당** (또는 EIP 별도 연결) — GitHub Actions가 SSH로 접속할 주소
- [ ] **로그인 키페어(.pem) 생성/다운로드** 또는 비밀번호 설정
- [ ] 생성 후 **공인 IP 기록** → 나중에 GitHub Secret `DEV_SSH_HOST`

## 2. 보안 그룹 (방화벽) 설정

- [ ] 인바운드 규칙 추가
  - `22/tcp` (SSH) — 가능하면 **GitHub Actions IP 대역** 또는 본인 IP로 제한 (전체 개방은 비권장)
  - `3111/tcp` (앱) — dev 접근 주체(사내 IP/프록시)로 제한 권장
  - postgres(5432), redis(6379)는 **외부에 열지 말 것** (컨테이너 내부 네트워크로만 통신)

## 3. 서버 초기 셋업 (SSH 접속 후)

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # 재로그인 후 sudo 없이 docker 사용

# docker compose v2 플러그인 확인
docker compose version

# --- swap 4GB 생성 (2GB RAM 보완, 필수) ---
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # Swap: 4.0Gi 확인
```

- [ ] Docker 설치 및 `docker compose version` 확인
- [ ] **swap 4GB 활성화 확인** (`free -h`)

## 4. 앱 디렉터리 / 환경파일 배치

```bash
sudo mkdir -p /opt/seoul-moment
sudo chown $USER:$USER /opt/seoul-moment
cd /opt/seoul-moment
```

- [ ] `/opt/seoul-moment/.env.dev` 생성 (기존 AWS dev의 `.env.dev` 내용 이전)
  - `DATABASE_HOST=postgres`, `REDIS_HOST=redis` (compose 서비스명으로)
  - `OPENSEARCH_*` 는 **비워두기** (dev 미사용)
  - `PORT=3111`
- [ ] `docker-compose.dev.yml` 을 이 디렉터리에 배치 (저장소 파일을 복사하거나 git clone)
  > GitHub Actions의 SSH 배포 스텝은 `cd /opt/seoul-moment` 에서 `docker compose -f docker-compose.dev.yml ...` 를 실행함.

## 5. ACR (컨테이너 레지스트리) 생성

- [ ] **ACR 콘솔 → 개인판(Personal Edition, 무료) 활성화**
- [ ] **네임스페이스(namespace)** 생성 — 예: `zipshow`
- [ ] **이미지 리포지토리** 생성 — 예: `seoul-moment-api` (Private)
- [ ] **레지스트리 접근 비밀번호 설정** (ACR 콘솔 → Access Credential)
- [ ] 레지스트리 엔드포인트 기록 — 예:
  - 표준판: `registry.ap-northeast-2.aliyuncs.com`
  - 개인판: `crpi-xxxxxxxx.ap-northeast-2.personal.cr.aliyuncs.com`
- [ ] 로그인 테스트 (서버 또는 로컬에서):
  ```bash
  docker login <ACR_REGISTRY> --username <계정명>
  ```

## 6. GitHub Actions 용 SSH 키 준비

GitHub Actions가 ECS에 접속할 전용 키를 준비한다 (콘솔 로그인 키와 분리 권장).

```bash
# 로컬에서 배포 전용 키 생성
ssh-keygen -t ed25519 -C "github-actions-dev-deploy" -f deploy_dev_key

# 공개키를 ECS의 authorized_keys 에 등록 (ECS에서)
cat deploy_dev_key.pub >> ~/.ssh/authorized_keys
```

- [ ] 배포 전용 키페어 생성
- [ ] **공개키**를 ECS `~/.ssh/authorized_keys` 에 등록
- [ ] **개인키**(`deploy_dev_key` 내용)는 GitHub Secret `DEV_SSH_KEY` 로 등록 (아래 7번)

## 7. GitHub 저장소 Secrets / Variables 등록

**Settings → Secrets and variables → Actions**, Environment 이름은 `DEV` 로 생성.

### Variables (vars) — 민감하지 않은 값
| 이름 | 예시 값 |
| --- | --- |
| `ACR_REGISTRY` | `crpi-xxxx.ap-northeast-2.personal.cr.aliyuncs.com` |
| `ACR_NAMESPACE` | `zipshow` |
| `ACR_REPOSITORY` | `seoul-moment-api` |

### Secrets — 민감한 값
| 이름 | 값 |
| --- | --- |
| `ACR_USERNAME` | ACR 로그인 계정명 |
| `ACR_PASSWORD` | ACR 접근 비밀번호 |
| `DEV_SSH_HOST` | ECS 공인 IP |
| `DEV_SSH_USER` | 예: `root` 또는 생성한 사용자 |
| `DEV_SSH_KEY` | 6번에서 만든 **개인키 전체 내용** |
| `DEV_SSH_PORT` | `22` (생략 시 기본 22) |

- [ ] 위 Variables 3개 등록
- [ ] 위 Secrets 6개 등록

## 8. 전환 & 검증

- [ ] `.github/workflows/deploy-dev.yml` + 수정된 `docker-compose.dev.yml` 머지 (다음 단계에서 작성)
- [ ] dev 브랜치에 테스트 커밋 push → **Actions 로그**에서 빌드/푸시/배포 성공 확인
- [ ] `http://<ECS_IP>:3111/docs` 헬스체크 정상 응답 확인
- [ ] `docker compose -f docker-compose.dev.yml ps` 로 api/postgres/redis 모두 healthy 확인
- [ ] 정상 확인 후 **기존 EC2의 Jenkins 파이프라인 비활성화 / EC2 종료**

---

## 참고: 비용 메모

- ECS 무료 트라이얼: **12개월 무료**, 이후 과금 (선불 약정 시 월 ≈ $20~25)
- ACR 개인판: **영구 무료**
- GitHub Actions: private repo 월 2,000분 무료 (dev 빌드엔 충분)
- 크레딧(개인 ≈ $1,700, 60일): 디스크/대역폭 초기 비용 상쇄용
