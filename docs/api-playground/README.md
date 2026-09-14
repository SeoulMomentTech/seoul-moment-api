# API Playground

장바구니·주문 기능을 로컬에서 직접 눌러보는 정적 페이지 묶음이다.
빌드도 서버도 필요 없다 — HTML 파일을 브라우저로 열면 된다.

## 쓰는 법

1. API 서버를 띄운다 — `npm run start:local` (기본 `http://localhost:3111`)
2. `index.html` 을 브라우저로 연다 (더블클릭)
3. **가입 + 로그인** 을 누르면 토큰이 저장된다. 이후 모든 페이지가 그 토큰을 쓴다

`file://` 로 열어도 동작한다. 서버가 `cors: true` 라 `Origin: null` 을 그대로 허용한다.
포트가 다르면 상단 **Base** 를 고치면 되고, 설정과 토큰은 localStorage 에 남아 페이지를 옮겨도 유지된다.

## 페이지

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | Base 주소·언어 설정, 사용자/관리자 로그인, 기본 배송지(프로필) 입력 |
| `product.html` | 상품상세 v1 조회. 옵션 조합을 고르면 `variantId` 가 잡히고 없는 조합·품절이 갈린다 |
| `cart.html` | 담기·조회·수량 변경·선택 삭제·전체 비우기. 선택한 라인을 주문서로 넘긴다 |
| `order.html` | 배송지별 금액 미리보기, 주문 생성, 주문 상세 |
| `shipping.html` | 배송비 요율 조회·수정, 외섬 지역 CRUD (관리자 토큰 필요) |

## 처음 한 번 해둘 것

- **외섬 지역이 비어 있으면 모든 주소가 본섬 요율로 계산된다.**
  `shipping.html` 의 **기본 5건 넣기** 를 눌러 澎湖縣·金門縣·連江縣·綠島鄉·蘭嶼鄉 을 등록한다.
- 주문에서 `useDefaultShipping: true` 를 쓰려면 프로필 주소와 전화번호가 있어야 한다.
  주소는 `index.html` 에서 저장할 수 있고, 전화번호는 인증 플로우가 따로 있어 DB 에서 직접 넣어야 한다.

  ```sql
  UPDATE "user" SET phone = '+886912345678' WHERE email = '...';
  ```
- 담을 상품이 없으면 `product_item` 과 `product_variant` 부터 만들어야 한다.
  어드민 API(`POST /admin/product/item`, `POST /product/variant`)를 쓰거나 DB 에 직접 넣는다.
