# Dev 배포 — 알리바바 클라우드 셋업 체크리스트

dev 브랜치 배포를 **알리바바 ECS + GitHub Actions** 로 이전하기 위한 서버 셋업 순서.

> 목표 구성: GitHub Actions 러너가 이미지를 빌드해 **SSH 터널을 통해 dev 서버의 로컬 레지스트리**(`127.0.0.1:5000`)로 push →
> 서버는 `docker compose pull && up` 으로 **api 컨테이너만** 교체.
>
> - **서버에서 빌드하지 않는다.** `npm ci` + `tsc` 가 사라지므로 배포 중 CPU/디스크 점유가 없다.
> - **알리 콘솔 작업이 필요 없다.** ACR 도, 컨테이너 레지스트리 계정도 쓰지 않는다.
> - **postgres / redis 는 이 문서의 범위 밖이다.** 별도로 관리되며 api 는 외부 네트워크 `app` 으로 붙는다.
> - OpenSearch 는 dev 에서 사용 안 함 (빈 env 로 정상 부팅 확인됨).
>
> prod(AWS ECR + ECS, `deploy-main.yml`)는 이 이전과 무관하며 그대로 둔다.

---

## 0. 사전 결정 사항

| 항목 | 값 (채워 넣기) |
| --- | --- |
| 리전 (Region) | 예: `ap-northeast-2` (서울) 또는 `ap-northeast-1` (도쿄) |
| 인스턴스 사양 | 무료 트라이얼 엔트리 (2vCPU / 2GB 급) |
| OS 이미지 | Ubuntu 22.04 LTS (x86_64) |
| 빌드 플랫폼 | x86 인스턴스 → `linux/amd64` (ARM 인스턴스면 워크플로의 `platforms` 와 `runs-on` 을 arm 으로 함께 변경) |

---

## 1. ECS 인스턴스 생성 (콘솔)

- [ ] **ECS 콘솔 → 인스턴스 생성**
  - 결제 방식: 무료 트라이얼 / (이후 包年包月 약정 전환 고려)
  - 리전: 위 0번에서 정한 값
  - 인스턴스 사양: 무료 트라이얼 대상 엔트리 (2GB 급)
  - 이미지: **Ubuntu 22.04 LTS**
  - 시스템 디스크: ESSD 40GB
  - 공인 IP: **할당** (또는 EIP 별도 연결) — GitHub Actions 가 SSH 로 접속할 주소
- [ ] **로그인 키페어(.pem) 생성/다운로드** 또는 비밀번호 설정
- [ ] 생성 후 **공인 IP 기록** → 나중에 GitHub Secret `DEV_SSH_HOST`

## 2. 보안 그룹 (방화벽) 설정

- [ ] 인바운드 규칙 추가
  - `22/tcp` (SSH) — 가능하면 **GitHub Actions IP 대역** 또는 본인 IP 로 제한 (전체 개방은 비권장)
  - `3111/tcp` (앱) — dev 접근 주체(사내 IP/프록시)로 제한 권장
  - **`5000`(레지스트리)은 절대 열지 않는다.** 루프백에만 바인딩하고 SSH 터널로만 접근한다.
  - postgres(5432), redis(6379)도 **외부에 열지 말 것** (컨테이너 내부 네트워크로만 통신)

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

## 4. 로컬 레지스트리 기동 (한 번만)

GitHub Actions 가 빌드한 이미지를 받아둘 곳이다. **`127.0.0.1` 에만 바인딩**하므로 외부에 노출되지 않고,
따라서 TLS 인증서도 basic auth 도 필요 없다.

```bash
sudo mkdir -p /opt/registry/data
sudo chown $USER:$USER /opt/registry/data

docker run -d --name registry --restart unless-stopped \
  -p 127.0.0.1:5000:5000 \
  -e REGISTRY_STORAGE_DELETE_ENABLED=true \
  -v /opt/registry/data:/var/lib/registry \
  registry:2

# 확인 — {} 가 나오면 정상
curl -fsS http://127.0.0.1:5000/v2/
```

- [ ] 레지스트리 컨테이너 기동 확인
- [ ] `ss -lntp | grep 5000` 으로 **`127.0.0.1:5000` 만** 리스닝하는지 확인 (`0.0.0.0:5000` 이면 잘못된 것)

> 이미지가 `/opt/registry/data` 에 누적된다. 40GB 디스크라 여유는 있지만, 몇 달에 한 번
> `du -sh /opt/registry/data` 로 확인하고 필요하면 컨테이너를 재생성해 비운다(dev 이미지는 재빌드하면 그만).

## 5. 앱 디렉터리 / 환경파일 배치

```bash
sudo mkdir -p /opt/seoul-moment
sudo chown $USER:$USER /opt/seoul-moment
cd /opt/seoul-moment
```

- [ ] `/opt/seoul-moment/.env.dev` 생성 (기존 AWS dev 의 `.env.dev` 내용 이전)
  - `DATABASE_HOST` / `REDIS_HOST` 는 별도로 관리 중인 postgres·redis 컨테이너의 **서비스명 또는 호스트**로
  - `OPENSEARCH_*` 는 **비워두기** (dev 미사용)
  - `PORT=3111`
- [ ] postgres / redis 스택을 먼저 띄우고, **docker network `app` 이 존재하는지 확인**
  ```bash
  docker network inspect app >/dev/null && echo OK
  # 없으면: docker network create app  (그리고 postgres/redis 를 이 네트워크에 연결)
  ```
- [ ] `docker-compose.dev.yml` 은 **배포 워크플로가 매번 scp 로 덮어쓴다.** 수동 배치 불필요.
- [ ] `/opt/seoul-moment/.env` 도 **배포 워크플로가 생성한다** (`API_IMAGE=...` 한 줄). 손대지 않는다.

## 6. GitHub Actions 용 SSH 키 준비

GitHub Actions 가 ECS 에 접속할 전용 키를 준비한다 (콘솔 로그인 키와 분리 권장).

```bash
# 로컬에서 배포 전용 키 생성
ssh-keygen -t ed25519 -C "github-actions-dev-deploy" -f deploy_dev_key

# 공개키를 ECS 의 authorized_keys 에 등록 (ECS 에서)
cat deploy_dev_key.pub >> ~/.ssh/authorized_keys
```

- [ ] 배포 전용 키페어 생성
- [ ] **공개키**를 ECS `~/.ssh/authorized_keys` 에 등록
- [ ] **개인키**(`deploy_dev_key` 내용)는 GitHub Secret `DEV_SSH_KEY` 로 등록 (아래 7번)
- [ ] 이 계정이 `docker` 그룹에 속해 있는지 확인 (`ssh <user>@<host> docker ps` 가 sudo 없이 되어야 한다)

## 7. GitHub 저장소 Secrets 등록

**Settings → Secrets and variables → Actions**, Environment 이름은 `DEV` 로 생성.

레지스트리를 서버 안에 두므로 **레지스트리 계정 정보가 필요 없다.** SSH 접속 정보만 있으면 된다.

| 이름 | 값 | 필수 |
| --- | --- | --- |
| `DEV_SSH_HOST` | ECS 공인 IP | O |
| `DEV_SSH_USER` | 예: `ubuntu` 또는 생성한 사용자 | O |
| `DEV_SSH_KEY` | 6번에서 만든 **개인키 전체 내용** | O |
| `DEV_SSH_PORT` | `22` (생략 시 기본 22) | X |
| `DEV_SSH_KNOWN_HOSTS` | `ssh-keyscan -H <IP>` 결과 | X (권장) |

- [ ] 위 Secrets 등록
- [ ] `DEV_SSH_KNOWN_HOSTS` 를 채우면 매 배포마다 호스트키를 무조건 신뢰(TOFU)하는 경고가 사라진다

## 8. 전환 & 검증

- [ ] `.github/workflows/deploy-dev.yml` + 수정된 `docker-compose.dev.yml` 을 dev 브랜치에 머지
- [ ] dev 브랜치에 테스트 커밋 push → **Actions 로그**에서 빌드/푸시/배포 성공 확인
- [ ] `http://<ECS_IP>:3111/docs` 헬스체크 정상 응답 확인
- [ ] `docker compose -f docker-compose.dev.yml ps` 로 api healthy 확인
- [ ] 롤백 리허설: Actions → **Run workflow** → `image_tag` 에 직전 태그(`dev-xxxxxxx`) 입력 → 정상 기동 확인
- [ ] 정상 확인 후 기존 EC2 종료

---

## 운영 메모

**롤백**
Actions → *Deploy to Alibaba ECS (dev)* → **Run workflow** → `image_tag` 에 되돌릴 태그 입력.
빌드를 건너뛰고 서버 레지스트리에 남아 있는 이미지를 바로 띄운다. 서버에서 직접 하려면:

```bash
cd /opt/seoul-moment
echo 'API_IMAGE=127.0.0.1:5000/seoul-moment-api:dev-a1b2c3d' > .env
docker compose -f docker-compose.dev.yml up -d
```

**남아 있는 태그 확인**

```bash
curl -s http://127.0.0.1:5000/v2/seoul-moment-api/tags/list
```

**빌드가 `push access denied` / TLS 오류로 실패할 때**
`setup-buildx-action` 버전에 따라 `buildkitd-config-inline` 키 이름이 `config-inline` 인 경우가 있다.
워크플로의 해당 키 이름을 바꿔본다.

## 비용 메모

- ECS 무료 트라이얼: **12개월 무료**, 이후 과금 (선불 약정 시 월 ≈ $20~25)
- 컨테이너 레지스트리: **서버 내부에서 운영하므로 추가 비용 없음** (디스크만 사용)
- GitHub Actions: private repo 월 2,000분 무료 (dev 빌드엔 충분)
- 크레딧(개인 ≈ $1,700, 60일): 디스크/대역폭 초기 비용 상쇄용
