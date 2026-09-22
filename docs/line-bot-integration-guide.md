# Seoul Moment — LINE Bot 연동 가이드

LINE Bot 에서 회원을 인증하고, 그 회원으로 장바구니·주문까지 잇는 데 필요한 API를 정리했다.
이 문서 하나로 붙일 수 있게 요청/응답/에러를 전부 적었다.

| 환경 | API Base                             | Swagger                                   |
| ---- | ------------------------------------ | ----------------------------------------- |
| DEV  | `https://api-dev.seoulmoment.com.tw` | `https://api-dev.seoulmoment.com.tw/docs` |
| PROD | `https://api.seoulmoment.com.tw`     | `https://api.seoulmoment.com.tw/docs`     |

- 아래 예시는 DEV 기준이다. **PROD 는 도메인만 바꾸면 되고 경로·본문은 같다.**
- 연동 확인은 DEV 에서 먼저 끝내고 PROD 로 옮긴다.
- `LINE_BOT_API_KEY` 값은 **환경별로 다르다.** 별도 경로로 전달한다.

---

## 0. 전체 흐름

```
[Bot] 이메일 입력 받음
   │
   ├─ ① POST /user/auth/line-bot/login          (lineUserId + email)
   │      200 → { userId, email, nickname, token, refreshToken }  ── 로그인 완료 → ④
   │      404 → 회원을 못 찾음                                     ── ② 로 진행
   │
   ├─ ② POST /user/auth/line-bot/email/code     (lineUserId + email)
   │      200 → 입력한 주소로 6자리 코드 발송
   │
   ├─ ③ POST /user/auth/line-bot/email/verify   (lineUserId + code)
   │      200 → { userId, email, nickname, token, refreshToken }
   │            · 가입된 이메일이면  → LINE 계정을 그 회원에 연결
   │            · 미가입 이메일이면  → 회원을 자동 생성 후 연결
   │
   └─ ④ token 으로 회원 API 호출 (장바구니 담기 → 주문)
```

**한 번 ③을 통과하면 그 다음부터는 ①만으로 로그인된다.** Bot 은 `lineUserId ↔ userId` 매핑을
저장해 두고, 매번 ①로 새 토큰을 받아 쓰면 된다.

---

## 1. 공통 규칙

### 요청 헤더

| 헤더              | 값                        | 적용                         |
| ----------------- | ------------------------- | ---------------------------- |
| `x-line-bot-key`  | 별도 전달하는 공유 시크릿 | **LINE Bot API 3개 필수**    |
| `Authorization`   | `Bearer {token}`          | 회원 API (장바구니·주문 등)  |
| `Accept-Language` | `ko` \| `en` \| `zh`      | 상품명·옵션명 등 다국어 응답 |
| `Content-Type`    | `application/json`        | 모든 POST                    |

`x-line-bot-key` 는 **서버끼리만 나눠 갖는 값**이다. LIFF·앱·웹 프론트에 심지 않는다.

### 응답 모양

성공:

```json
{ "result": true, "data": {} }
```

실패:

```json
{
  "message": "사람이 읽는 메시지",
  "code": "NOT_FOUND_DATA",
  "traceId": "3f2c...",
  "data": {}
}
```

`data` 는 추가 정보가 있을 때만 붙는다. 문의 시 `traceId` 를 같이 주면 서버 로그에서 바로 찾을 수 있다.

### 공통 에러

| 상태 | `code`                  | 언제                                                      |
| ---- | ----------------------- | --------------------------------------------------------- |
| 400  | `BAD_REQUEST`           | 필드 누락·형식 오류, **정의되지 않은 키를 보냈을 때**     |
| 401  | `UNAUTHORIZED`          | `x-line-bot-key` 없음/불일치, 토큰 만료, 인증 코드 불일치 |
| 403  | `FORBIDDEN`             | refreshToken 만료·변조                                    |
| 404  | `NOT_FOUND_DATA`        | 대상 없음                                                 |
| 409  | `CONFLICT`              | 중복·충돌                                                 |
| 500  | `INTERNAL_SERVER_ERROR` | 서버 오류, 메일 발송 실패                                 |

> 정의하지 않은 키를 본문에 넣으면 400 이다. 예시에 없는 필드는 보내지 않는다.

---

## 2. ① 회원 조회 + 로그인

```
POST /user/auth/line-bot/login
```

연결된 회원이면 **인증 없이** 로그인 토큰을 준다.

**Request**

```json
{
  "lineUserId": "U4af4980629...",
  "email": "test@test.com"
}
```

| 필드         | 타입        | 필수 | 설명                                                       |
| ------------ | ----------- | ---- | ---------------------------------------------------------- |
| `lineUserId` | string(255) | ✅   | Messaging API 가 주는 사용자 ID                            |
| `email`      | string      | ✅   | 사용자가 입력한 이메일. 앞뒤 공백·대문자는 서버가 다듬는다 |

**Response 200**

```json
{
  "result": true,
  "data": {
    "userId": 1,
    "email": "test@test.com",
    "nickname": "seri",
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

**Response 404** — 회원을 못 찾음. ②로 진행한다.

```json
{
  "message": "이 LINE 계정에 연결된 회원이 없습니다. 이메일 인증이 필요합니다.",
  "code": "NOT_FOUND_DATA",
  "data": { "emailJoined": true }
}
```

`emailJoined` 는 **요청에 넣은 이메일이 우리 DB에 있는지**를 뜻한다.

| 값      | 의미                                                    | Bot 안내 문구(예시)                                |
| ------- | ------------------------------------------------------- | -------------------------------------------------- |
| `true`  | 그 이메일로 가입된 회원이 있다 (이 LINE 계정만 연결 전) | "인증번호를 입력하시면 기존 회원으로 로그인됩니다" |
| `false` | 그 이메일로 가입된 회원이 없다                          | "인증번호를 입력하시면 회원가입이 완료됩니다"      |

**어느 쪽이든 다음 동작은 같다(②).** 분기는 안내 문구용이고, 무시해도 흐름은 정상 동작한다.

| 상태 | 사유                                           |
| ---- | ---------------------------------------------- |
| 401  | `x-line-bot-key` 없음/불일치                   |
| 404  | 연결된 회원 없음 / 연결은 있으나 이메일 불일치 |

```bash
curl -X POST 'https://api-dev.seoulmoment.com.tw/user/auth/line-bot/login' \
  -H 'Content-Type: application/json' \
  -H 'x-line-bot-key: {발급받은 키}' \
  -d '{"lineUserId":"U4af4980629...","email":"test@test.com"}'
```

---

## 3. ② 인증 코드 발송

```
POST /user/auth/line-bot/email/code
```

입력한 주소로 **6자리 숫자 코드**를 보낸다. 가입 여부·LINE 연결 여부를 보지 않는다
(미가입이면 ③에서 그대로 가입된다).

**Request**

```json
{
  "lineUserId": "U4af4980629...",
  "email": "test@test.com"
}
```

**Response 200** — 본문이 없다(빈 응답). 상태 코드만 보면 된다.

| 상태 | 사유                                      |
| ---- | ----------------------------------------- |
| 400  | 이메일 형식 오류                          |
| 401  | `x-line-bot-key` 없음/불일치              |
| 500  | 인증 메일 발송 실패 → 잠시 후 재시도 안내 |

- 코드 유효시간 **5분**
- 같은 `lineUserId` 로 다시 부르면 **이전 코드는 무효**가 되고 새 코드로 덮어써진다
- 코드는 `lineUserId` 기준으로 보관돼, 회원가입·비밀번호 찾기 코드와 섞이지 않는다

```bash
curl -X POST 'https://api-dev.seoulmoment.com.tw/user/auth/line-bot/email/code' \
  -H 'Content-Type: application/json' \
  -H 'x-line-bot-key: {발급받은 키}' \
  -d '{"lineUserId":"U4af4980629...","email":"test@test.com"}'
```

---

## 4. ③ 인증 코드 검증 (연결 · 자동 가입)

```
POST /user/auth/line-bot/email/verify
```

코드가 맞으면 메일함을 연 사람이 본인임이 확인된다. 그 자리에서

- 가입된 이메일 → 그 회원에 **LINE 계정 연결**
- 미가입 이메일 → **회원 자동 생성** 후 연결

어느 쪽이든 ①과 **똑같은 모양**을 돌려준다.

**Request**

```json
{
  "lineUserId": "U4af4980629...",
  "code": "123456"
}
```

| 필드         | 타입        | 필수 | 설명                                                        |
| ------------ | ----------- | ---- | ----------------------------------------------------------- |
| `lineUserId` | string(255) | ✅   | ②에서 쓴 것과 같은 값                                       |
| `code`       | string      | ✅   | **6자리 숫자 문자열**. `"012345"` 처럼 앞의 0을 살려 보낸다 |

이메일은 다시 보내지 않는다. ②에서 보낸 주소를 서버가 기억한다.

**Response 200**

```json
{
  "result": true,
  "data": {
    "userId": 1,
    "email": "test@test.com",
    "nickname": "test@test.com",
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

| 상태 | 사유                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| 400  | `code` 가 6자리 숫자가 아님                                                                  |
| 401  | 코드 만료(5분)·불일치, 또는 `x-line-bot-key` 오류                                            |
| 409  | 이 LINE 계정이 **다른 회원**에게 이미 연결됨 / 그 회원에게 **다른 SNS(구글)** 가 이미 연결됨 |

409는 사용자가 스스로 풀 수 없다. "고객센터로 문의" 안내가 맞다.

```bash
curl -X POST 'https://api-dev.seoulmoment.com.tw/user/auth/line-bot/email/verify' \
  -H 'Content-Type: application/json' \
  -H 'x-line-bot-key: {발급받은 키}' \
  -d '{"lineUserId":"U4af4980629...","code":"123456"}'
```

### 자동 가입으로 만들어지는 회원

| 항목             | 값                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------ |
| 이메일           | 인증한 주소 (소문자)                                                                 |
| 닉네임           | **이메일과 동일**. 이미 쓰는 사람이 있으면 `test@test.com-a3f9c1` 처럼 꼬리가 붙는다 |
| 비밀번호         | 사용 불가한 임의값 → **이메일+비밀번호 로그인 불가** (LINE 경로로만 로그인)          |
| 마케팅 수신 동의 | 신상품 알림·광고/이벤트·맞춤 추천 **전부 동의**로 저장                               |

> 마케팅 수신 **동의 안내와 확인은 Bot 대화에서 받는 것을 전제**로 전부 동의 처리한다.
> 가입 단계에서 안내 문구를 반드시 노출해 주기 바란다.

---

## 5. ④ 발급받은 토큰 쓰기

`token` 은 웹 로그인과 같은 토큰이다. 회원 API에 그대로 쓴다.

```
Authorization: Bearer {token}
```

토큰이 만료되면(401) `refreshToken` 으로 재발급한다.

```
GET /user/auth/one-time-token
Authorization: Bearer {refreshToken}

→ 200 { "data": { "oneTimeToken": "eyJhbGciOi..." } }
```

`refreshToken` 도 만료되면 403 이다. 그때는 ①부터 다시 하면 된다(이미 연결돼 있으므로 바로 200).

### 장바구니 담기

```
POST /user/cart
Authorization: Bearer {token}
```

```json
{
  "items": [{ "productVariantId": 101, "quantity": 1 }]
}
```

- `productVariantId` 는 **옵션 조합(SKU) ID** 다. 상품상세 `GET /product/v1/{productItemId}` 응답의 `variants[].id`.
- 단건도 **배열**로 보낸다. 같은 SKU를 다시 담으면 라인이 늘지 않고 **수량이 합산**된다.
- 하나라도 담을 수 없으면 전부 담기지 않는다.

```json
// 201
{
  "result": true,
  "data": {
    "items": [{ "productVariantId": 101, "cartItemId": 12, "quantity": 1 }],
    "totalCount": 3
  }
}
```

| 상태 | 사유                                     |
| ---- | ---------------------------------------- |
| 401  | 토큰 만료/누락                           |
| 404  | 없는 `productVariantId`                  |
| 409  | 재고 부족 (`data` 에 남은 수량이 실린다) |

장바구니 개수: `GET /user/cart/count` → `{ "data": { "count": 3 } }`
장바구니 조회: `GET /user/cart`

### 주문

주문서 금액 계산과 주문 생성은 아래 두 API다. 장바구니를 거치지 않고 **바로 구매**도 된다.

```
POST /user/order/preview   { items | cartItemIds, city?, district? }   → 금액·배송비 계산 (DB 변경 없음)
POST /user/order           { items | cartItemIds, paymentMethod, useDefaultShipping, shipping? } → 주문 생성
GET  /user/order/{orderId} → 주문 상세
```

- `items` 와 `cartItemIds` 는 **둘 중 하나만** 보낸다(같이 보내거나 둘 다 빼면 400).
  - 상품상세에서 바로 구매 → `items: [{ productVariantId, quantity }]`
  - 장바구니에서 주문 → `cartItemIds: [12, 13]`
- 배송비는 배송지 `city`(縣市)·`district`(區/鄉)로 정해진다. 주소를 바꿀 때마다 `preview` 를 다시 부른다.
- 주소를 모르면 `city`·`district` 를 빼고 부르면 본섬 기준 **예상 배송비**(`isShippingEstimated: true`)가 온다.
- 주문은 `PENDING` 으로 생성되고 **재고 차감·결제는 아직 붙어 있지 않다**(LINE Pay/ECPay 연동 예정).

자세한 필드는 Swagger 와 `docs/cart-order-frontend-guide.html` 을 참고한다.

---

## 6. 에러 대응 정리

| 상황                           | 상태 | Bot 동작                                               |
| ------------------------------ | ---- | ------------------------------------------------------ |
| 키 오류                        | 401  | 호출 중단. 서버팀에 문의(설정 문제)                    |
| ①에서 회원 못 찾음             | 404  | ②로 진행 (`emailJoined` 로 문구만 구분)                |
| 이메일 형식 오류               | 400  | "이메일 형식을 확인해 주세요"                          |
| 코드 틀림·만료                 | 401  | "인증번호가 만료되었거나 일치하지 않습니다" → ② 재발송 |
| LINE 계정이 다른 회원에 연결됨 | 409  | "고객센터로 문의해 주세요"                             |
| 메일 발송 실패                 | 500  | "잠시 후 다시 시도해 주세요"                           |
| 재고 부족                      | 409  | 남은 수량을 안내하고 수량 조정                         |

---

## 7. 연동 체크리스트

- [ ] `x-line-bot-key` 값 수령 및 Bot 서버 환경변수 등록 (코드·저장소에 하드코딩 금지)
- [ ] DEV 에서 ① → ② → ③ → 장바구니까지 한 번 통과
- [ ] `lineUserId ↔ userId` 매핑 저장, 이후 요청은 ①로 토큰 갱신
- [ ] 401(토큰 만료) 시 `refreshToken` 으로 재발급하는 처리
- [ ] 마케팅 수신 동의 안내 문구를 가입 단계 대화에 포함
- [ ] PROD 전환 — 도메인을 `https://api.seoulmoment.com.tw` 로 바꾸고 **PROD 용 키**로 교체

### `lineUserId` 관련 주의

LINE 의 `U...` 사용자 ID는 **프로바이더 단위로 발급**된다.
우리가 저장하는 값은 **LINE 로그인 채널**의 `sub` 이고, Bot 이 보내는 값은 **Messaging API 채널**의 userId다.
두 채널이 **같은 LINE 프로바이더** 아래에 있어야 두 값이 일치한다.

프로바이더가 다르면 웹에서 LINE 로그인을 이미 한 회원도 ①에서 계속 404가 난다
(이 경우 ②③으로 인증을 마치면 Bot 쪽 ID로 연결이 새로 만들어지므로 흐름 자체는 진행된다).
연동 전에 LINE Developers 콘솔에서 두 채널의 프로바이더를 확인해 주기 바란다.

---

## 8. 문의

- 서버 이슈: 실패 응답의 `traceId` 와 호출 시각, 환경(DEV/PROD)을 함께 전달
- 전체 스펙: DEV `https://api-dev.seoulmoment.com.tw/docs` · PROD `https://api.seoulmoment.com.tw/docs`
