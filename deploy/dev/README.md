# Dev 환경 배포 가이드 (nCloud VM + Jenkins)

dev 브랜치 push → Jenkins(같은 VM에서 실행) → `docker-compose.dev.yml` 빌드·실행 흐름.
public 레포에 시크릿이 들어가지 않도록, 환경변수는 VM의 `/opt/seoul-moment/.env.dev`에 둔다.

---

## 1. VM 초기 셋업 (1회)

### 1-1. 패키지

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin curl git openjdk-17-jre
```

### 1-2. Jenkins 설치

```bash
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
    | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
    https://pkg.jenkins.io/debian-stable binary/" \
    | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update
sudo apt-get install -y jenkins
sudo systemctl enable --now jenkins
```

초기 비밀번호: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`
웹 UI: `http://<VM-IP>:8080`

### 1-3. Jenkins user 가 docker 명령 쓰도록 그룹 추가

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### 1-4. 시크릿 파일 생성

```bash
sudo mkdir -p /opt/seoul-moment
sudo cp /path/to/your/.env.dev /opt/seoul-moment/.env.dev
sudo chown root:jenkins /opt/seoul-moment/.env.dev
sudo chmod 640 /opt/seoul-moment/.env.dev
```

> `.env.dev` 키 목록은 레포의 `.env.example` 참고. 실제 값은 1Password / 팀 비밀창고 등에서 가져오기.

### 1-5. 방화벽

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 8080/tcp   # Jenkins (관리자 IP만 허용 권장)
sudo ufw allow 3000/tcp   # API (앞단에 nginx/LB 두면 닫기)
sudo ufw enable
```

---

## 2. Jenkins Job 셋업 (1회)

1. Jenkins UI → New Item → **Pipeline** 선택, 이름: `seoul-moment-api-dev`
2. **Build Triggers**: `GitHub hook trigger for GITScm polling` 체크
3. **Pipeline → Definition**: `Pipeline script from SCM`
   - SCM: Git
   - Repository URL: `https://github.com/<org>/seoul-moment-api.git`
   - Branch: `*/dev`
   - Script Path: `Jenkinsfile`
4. **GitHub 레포 → Settings → Webhooks**:
   - Payload URL: `http://<VM-IP>:8080/github-webhook/`
   - Content type: `application/json`
   - Events: `Just the push event`

> 레포가 public이면 GitHub credential 불필요. private이면 deploy key 또는 PAT 등록.

---

## 3. 배포 흐름

`dev` 브랜치 push → GitHub webhook → Jenkins job 트리거 →
`Jenkinsfile`이 다음을 순서대로 실행:

1. Checkout (`dev` 브랜치)
2. `/opt/seoul-moment/.env.dev` 존재 확인
3. `docker compose -f docker-compose.dev.yml build --pull`
4. `docker compose -f docker-compose.dev.yml up -d`
5. `curl http://localhost:3000/docs` 헬스체크 (최대 90초 대기)
6. `docker image prune -f` 로 이전 이미지 정리

실패 시 컨테이너 로그 200줄을 빌드 콘솔에 덤프.

---

## 4. 시크릿 갱신

`.env.dev` 값이 바뀌면:

```bash
sudo vi /opt/seoul-moment/.env.dev
sudo docker compose -f /var/lib/jenkins/workspace/seoul-moment-api-dev/docker-compose.dev.yml up -d --force-recreate
```

또는 Jenkins에서 빈 commit으로 한 번 더 트리거해도 OK.

---

## 5. 트러블슈팅

| 증상 | 원인 / 조치 |
|------|----------|
| `permission denied while trying to connect to Docker daemon` | `jenkins` 사용자가 `docker` 그룹에 없음 → 1-3 단계 |
| `/opt/seoul-moment/.env.dev not found` | 파일 미생성 또는 `jenkins` 그룹이 읽기 권한 없음 (chmod 640) |
| 헬스체크 실패 | `docker compose -f docker-compose.dev.yml logs api` 로 확인 |
| 포트 3000 충돌 | 기존 ECS/다른 컨테이너 미정리 → `docker ps`, `docker rm -f` |
| 디스크 가득 | `docker system prune -af --volumes` (주의: 사용 중 아닌 볼륨도 삭제) |
