# ECS Fargate 고정 아웃바운드 IP 구성 (Bastion NAT)

> 이 문서는 공개용입니다. 계정 ID·IP·리소스 ID 등 환경별 값은 모두 `<PLACEHOLDER>`로 치환되어 있습니다.
> 실제 적용 시 본인 환경의 값으로 바꿔 사용하세요.

## 목적

외부 API(예: SMS 발송 서비스 등)가 **IP 화이트리스트**를 요구하는데, ECS Fargate 태스크의 아웃바운드 IP가 재배포·재시작마다 바뀌어 등록이 불가능했다. NAT Gateway는 비용 부담(월 $40~45+)이 커서, **기존 Bastion EC2를 NAT 인스턴스로 겸용**해 고정 아웃바운드 IP를 확보했다.

---

## 환경 정보 (예시 — 본인 값으로 치환)

| 항목 | 값 |
|------|-----|
| 리전 | `<REGION>` (예: ap-east-2) |
| VPC | `<VPC_ID>` |
| Bastion 인스턴스 | `<BASTION_INSTANCE_ID>` (Amazon Linux 2023, ARM/aarch64) |
| Bastion 프라이빗 IP | `<BASTION_PRIVATE_IP>` |
| Bastion 고정 아웃바운드 IP (EIP) | `<BASTION_EIP>` (외부 API 화이트리스트 등록용) |
| Bastion ENI | `<BASTION_ENI_ID>` |
| Bastion 네트워크 인터페이스 | `<OUT_IFACE>` (예: ens5) |
| ECS 클러스터 | `<ECS_CLUSTER>` |
| ECS 서비스 | `<ECS_SERVICE>` (Fargate) |
| 컨테이너명 / 포트 | `<CONTAINER_NAME>` / `<CONTAINER_PORT>` |
| 프라이빗 서브넷 a | `<PRIVATE_SUBNET_A>` (`<PRIVATE_CIDR_A>`) |
| 프라이빗 서브넷 b | `<PRIVATE_SUBNET_B>` (`<PRIVATE_CIDR_B>`) |
| 프라이빗 라우트 테이블(main) | `<PRIVATE_ROUTE_TABLE_ID>` |
| 태스크 보안 그룹 | `<TASK_SG_ID>` |
| Task Role | `<ECS_TASK_ROLE>` |
| VPC CIDR | `<VPC_CIDR>` (예: 10.0.0.0/16) |

---

## 아키텍처

```
사용자
  │ 인바운드 (HTTPS)
  ▼
ALB (퍼블릭 서브넷, Internet-facing)
  │ VPC 내부 프라이빗 IP 통신
  ▼
ECS Fargate 태스크 (프라이빗 서브넷, 퍼블릭 IP 없음)
  │ 아웃바운드 (외부 API 호출 등)
  ▼
Bastion EC2 (NAT 역할, 퍼블릭 서브넷, 고정 IP)
  │
  ▼
인터넷 (외부 API)
```

핵심 개념:
- **인바운드**(사용자 요청), **DB 조회**, **응답**은 NAT을 거치지 않음 → 수만 명 트래픽도 Bastion에 부하 없음
- **아웃바운드**(코드에서 `axios`/`fetch`로 외부 호출)만 NAT(Bastion)을 거침 → 이때 Bastion의 고정 IP가 출발지 IP가 됨

---

## 작업 단계

### 1. Bastion을 NAT 인스턴스로 설정

**1-1. 소스/대상 확인 비활성화 (콘솔)**

EC2 콘솔 → Bastion 인스턴스 → 작업 → 네트워킹 → 소스/대상 확인 변경 → **중지** 체크 → 저장

> NAT은 자기 것이 아닌 IP의 패킷을 전달해야 하는데, EC2는 기본적으로 이를 차단함. 이 설정을 꺼야 NAT이 동작함. (필수)

**1-2. IP 포워딩 활성화 (Bastion SSH)**

```bash
# 즉시 적용
sudo sysctl -w net.ipv4.ip_forward=1

# 재부팅 후에도 유지
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-nat.conf
sudo sysctl -p /etc/sysctl.d/99-nat.conf
```

**1-3. iptables 설치 + 마스커레이딩 규칙 (Bastion SSH)**

`<OUT_IFACE>`는 외부로 나가는 인터페이스. `ip route | grep default`의 `dev` 뒤 이름으로 확인 (AL2023은 보통 `ens5`).

```bash
# AL2023에는 iptables가 기본 미설치
sudo dnf install -y iptables-services

# 마스커레이딩 규칙 추가
sudo iptables -t nat -A POSTROUTING -o <OUT_IFACE> -j MASQUERADE

# 규칙 확인
sudo iptables -t nat -L POSTROUTING -n -v
```

**1-4. iptables 규칙 영속화 (재부팅 대비, Bastion SSH)**

```bash
sudo systemctl enable iptables
sudo service iptables save

# 확인
sudo cat /etc/sysconfig/iptables | grep MASQUERADE
# → -A POSTROUTING -o <OUT_IFACE> -j MASQUERADE 가 보이면 성공
```

### 2. 프라이빗 라우트 테이블 수정 (콘솔)

VPC 콘솔 → 라우팅 테이블 → `<PRIVATE_ROUTE_TABLE_ID>` (프라이빗 서브넷이 따르는 라우트 테이블) → 라우팅 편집 → 경로 추가:

| 대상 | 타겟 |
|------|------|
| 0.0.0.0/0 | Network Interface → `<BASTION_ENI_ID>` (Bastion ENI) |

결과:
```
<VPC_CIDR>    → local
0.0.0.0/0     → <BASTION_ENI_ID>   (전체 아웃바운드를 Bastion NAT으로)
```

> 라우팅을 특정 IP로 좁히지 않고 전체 NAT(0.0.0.0/0)으로 구성. 사용자 트래픽(DB 응답)은 NAT을 안 타므로 부하 문제 없음.

### 3. Bastion 보안 그룹 인바운드 규칙 (콘솔)

EC2 콘솔 → Bastion 보안 그룹 → 인바운드 규칙 편집 → 프라이빗 서브넷 대역 허용:

| 유형 | 소스 |
|------|------|
| 모든 트래픽 | `<PRIVATE_CIDR_A>` |
| 모든 트래픽 | `<PRIVATE_CIDR_B>` |
| SSH (22) | `<관리자 IP 대역>` (권장: 전체 개방 대신 특정 IP로 제한) |

> 프라이빗 서브넷의 태스크가 보낸 NAT 트래픽을 Bastion이 받도록 허용. 인터넷 무단 접근은 차단.
> **보안 권고: SSH 인바운드는 `0.0.0.0/0`(전체 개방)을 피하고 관리자 IP로 제한하거나, SSM Session Manager로 접속하고 SSH 포트는 닫는 것을 권장.**

### 4. ECS 서비스를 프라이빗 서브넷으로 이전 (콘솔)

ECS 콘솔 → `<ECS_CLUSTER>` → `<ECS_SERVICE>` → 업데이트 → 네트워킹:

- 서브넷: 퍼블릭 → **프라이빗 2개** (`<PRIVATE_SUBNET_A>`, `<PRIVATE_SUBNET_B>`)
- 퍼블릭 IP 자동 할당: **DISABLED**
- 보안 그룹: 기존 그대로 (`<TASK_SG_ID>`, ALB 인바운드 허용)

> ALB ↔ 태스크는 프라이빗 IP로 통신하므로 퍼블릭/프라이빗 이전과 무관하게 정상 동작.
> 타겟 그룹 등록/해제는 ECS가 롤링 배포로 자동 처리. 새 태스크가 HEALTHY 된 후 기존 태스크 종료 → 서비스 공백 없음.

---

## 검증: ECS Exec으로 아웃바운드 IP 확인

### 사전 준비

**Task Role에 SSM 권한 추가** (IAM 콘솔 → `<ECS_TASK_ROLE>` → 인라인 정책 `ECSExecPolicy`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ],
      "Resource": "*"
    }
  ]
}
```

**서비스에 Exec 활성화** (Bastion에서, CLI):

```bash
aws ecs update-service \
  --cluster <ECS_CLUSTER> \
  --service <ECS_SERVICE> \
  --enable-execute-command \
  --force-new-deployment \
  --region <REGION>
```

> `--force-new-deployment`로 태스크가 교체되며 Exec 설정이 새 태스크에 적용됨.

**Bastion에 Session Manager 플러그인 설치** (AL2023 ARM):

```bash
sudo dnf install -y https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_arm64/session-manager-plugin.rpm
session-manager-plugin --version
```

> x86_64 인스턴스라면 `linux_arm64` 대신 `linux_64bit` 사용.

### 접속 및 확인

```bash
# 실행 중인 태스크 ID 확인
aws ecs list-tasks \
  --cluster <ECS_CLUSTER> \
  --service-name <ECS_SERVICE> \
  --region <REGION>

# 태스크에 접속
aws ecs execute-command \
  --cluster <ECS_CLUSTER> \
  --task <태스크ID> \
  --container <CONTAINER_NAME> \
  --interactive \
  --command "/bin/sh" \
  --region <REGION>

# 컨테이너 안에서 아웃바운드 IP 확인 (curl 없으면 아래 대안)
wget -qO- https://checkip.amazonaws.com
# 또는 (Node 앱)
node -e "fetch('https://checkip.amazonaws.com').then(r=>r.text()).then(t=>console.log(t))"
```

→ 출력된 IP가 **Bastion의 EIP와 일치**하면 NAT 정상 동작. 이 IP를 외부 API 화이트리스트에 등록.

---

## 남은 / 권장 작업

### 1. Bastion 퍼블릭 IP를 EIP로 고정
자동 할당 퍼블릭 IP는 stop/start 시 변경되어 외부 API 연동이 끊김. 반드시 EIP로 고정.
- EC2 콘솔 → 탄력적 IP → 할당 → Bastion에 연결
- 연결되어 사용 중인 EIP는 추가 요금 없음 (자동 IP와 동일한 IPv4 요금). 할당만 하고 미사용 시에만 과금.
- 외부 API 화이트리스트에 등록하는 IP는 반드시 이 고정 EIP.

> 참고: ALB가 사용 중인 EIP는 그대로 둘 것. ALB ENI에 붙은 EIP는 `describe-addresses`에서
> Instance가 None으로 표시되는 게 정상이며, 떼어도 비용 절감 없고 서비스 위험만 있음.

### 2. VPC 엔드포인트 (선택, 안정성 보강)
현재 ECR 이미지 풀·CloudWatch 로그도 Bastion NAT을 거침 → Bastion이 단일 장애점(SPOF).
- 트래픽 부하로 죽을 일은 거의 없으나, Bastion 재부팅·장애 시 배포가 막힐 수 있음
- ECR(api/dkr), S3, CloudWatch Logs용 VPC 엔드포인트를 만들면 해당 트래픽이 AWS 내부망 직통 → Bastion 의존 제거
- 비용(엔드포인트 시간당+데이터 요금)과 안정성을 저울질해 필요 시 추가

### 3. Bastion NAT의 한계 (운영 고려사항)
Bastion 1대에 의존하는 NAT은 SPOF임. 가용성이 중요한 운영 환경에서는 다음을 고려:
- NAT Gateway(AZ별 이중화) 또는 fck-nat(ASG로 자동 복구) 등으로 대체
- 본 구성은 비용 최소화가 우선인 환경에 적합

### 4. 외부 API 호출 캐싱 (해당 시)
외부 API에서 데이터를 실시간으로 가져오는 경우, 매 사용자 요청마다 호출하면 외부 API rate limit + NAT 부하 발생.
→ 일정 주기 캐싱(메모리/Redis)으로 실제 외부 호출 횟수를 축소 권장.
(데이터를 내부 DB에서 제공하는 경우 해당 없음)

---

## 핵심 개념 정리

- **아웃바운드 = 내 코드가 `axios`/`fetch` 등으로 외부에 먼저 연결을 거는 것.** 이것만 NAT을 탄다.
- 인바운드(사용자 요청), 응답, VPC 내부 DB 통신은 NAT과 무관 → 사용자 트래픽이 많아도 Bastion 부하 없음.
- 라우트 테이블은 도메인이 아닌 **IP만** 인식 → 도메인 기반 라우팅 불가.
- ALB(L7)는 EIP 직접 지정 불가, NLB(L4)만 가능. ALB는 DNS 이름(Route 53 Alias)으로 연결하는 것이 표준.
- Internet-facing ALB의 퍼블릭 IPv4 요금은 ALB 사용의 필수 비용 → 떼어낼 수 없음.
- 연결되어 사용 중인 EIP는 추가 요금 없음. 할당만 하고 미사용 시에만 과금.
