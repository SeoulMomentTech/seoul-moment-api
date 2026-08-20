# FCM 전환 — 앱(안드로이드)에서 할 일

백엔드는 끝났습니다. 이 문서는 **앱 쪽에 남은 작업**만 정리한 것입니다.
전체 배경과 왜 FCM 으로 가는지는 앱 저장소의 `docs/PUSH_NOTIFICATIONS.md` 를 보세요.

작업 대상: `C:\Users\zipshow_backend\PERSONAL\wedding-plant-android`

---

## 백엔드가 이미 해 둔 것

| | 상태 |
| --- | --- |
| `POST /plan/user/device-token` | ✅ |
| `DELETE /plan/user/device-token` | ✅ |
| 채팅 저장 시 FCM 발송 (data-only) | ✅ |
| 만료 토큰 자동 정리 | ✅ |

앱이 이미 호출하고 있던 `PlanRepository.registerDeviceToken` 은 **더 이상 404 가 아닙니다.**
그 함수의 "이 엔드포인트는 아직 백엔드에 없습니다" 주석은 이제 사실이 아니니 지워도 됩니다.

---

## 1. Firebase 콘솔에 안드로이드 앱 등록

1. 프로젝트 `wedding-plant` → 안드로이드 앱 추가
2. 패키지명: `com.zipshowkorea.weddingplant`
3. `google-services.json` 을 `app/` 에 넣기 — **git 에 올리지 말 것**

`google-services.json` 이 없으면 Firebase 가 초기화되지 않아
`WeddingPlantMessagingService` 가 아예 호출되지 않습니다. 그래도 앱은 정상 동작합니다(SSE 경로).

## 2. Gradle 설정

- `libs.versions.toml` 에 `firebase-bom`, `firebase-messaging` 추가
- `app/build.gradle.kts` 에 `com.google.gms.google-services` 플러그인 적용

## 3. 로그아웃 시 토큰 해제 — **새로 추가된 작업**

로그아웃한 기기를 발송 대상에서 빼지 않으면, 로그아웃해도 그 기기로 알림이 계속 갑니다.
기기를 남에게 넘기거나 공용 기기를 쓸 때 남의 채팅 내용이 그대로 뜹니다.

### 3-1. `PlanRepository` 에 함수 추가

```kotlin
/** DELETE /plan/user/device-token — 로그아웃한 기기를 푸시 대상에서 뺍니다. */
suspend fun unregisterDeviceToken(token: String): ApiResult<Unit> =
    api.requestUnit(
        path = "/plan/user/device-token",
        method = "DELETE",
        body = buildJsonObject { put("token", token) },
        skipLoading = true,
    )
```

`requestRaw` 는 `body != null` 이면 DELETE 에도 본문을 실어 보내므로 그대로 동작합니다.

### 3-2. `AuthViewModel.logout()` 에서 호출

> **⚠️ 반드시 `container.tokenStore.clear()` 보다 먼저 호출해야 합니다.**
>
> 이 API 는 `Authorization: Bearer <JWT>` 를 요구합니다. 지금 `logout()` 은 로컬 세션을
> **가장 먼저 동기적으로** 지우도록 되어 있는데(그렇게 만든 이유가 함수 주석에 있습니다),
> 그 뒤에 부르면 토큰이 없어 401 로 떨어지고 서버에는 기기 토큰이 그대로 남습니다.

여기에 진짜 어려운 지점이 하나 있습니다. 지금 `logout()` 이 로컬 세션을 **먼저 동기적으로**
지우는 건 의도된 것입니다 — 카카오 서버 호출을 기다렸다가 지우게 했더니, 그 호출이 실패하거나
콜백이 안 올 때 로그아웃이 아예 안 되고 JWT 가 기기에 남는 버그가 났었다고 함수 주석에 적혀
있습니다. 그런데 토큰 해제는 JWT 가 필요하니 `clear()` **앞**이어야 합니다.

`ApiClient.requestRaw` 는 요청을 만들 때마다 `tokenStore.get()` 을 읽습니다. 그래서 코루틴만
띄워 두고 곧바로 `clear()` 로 넘어가면 **경합이 납니다** — 요청이 헤더를 만들기 전에 토큰이
지워지면 401 이 되고, 서버에는 기기 토큰이 그대로 남습니다.

해법은 "기다리되, 무한정 기다리지 않는" 것입니다. 타임아웃을 걸면 순서도 지키고 로그아웃이
막히지도 않습니다.

```kotlin
fun logout(onDone: () -> Unit) {
    viewModelScope.launch {
        // 서버에서 이 기기 토큰을 먼저 뺍니다. JWT 가 필요하므로 clear() 앞이어야 합니다.
        // 네트워크가 죽어 있어도 로그아웃이 막히면 안 되므로 타임아웃을 겁니다.
        PushTokenRegistrar.currentToken.value?.let { token ->
            runCatching {
                withTimeoutOrNull(3_000) {
                    container.planRepository.unregisterDeviceToken(token)
                }
            }
        }

        // 성공했든 실패했든 로컬 로그아웃은 반드시 진행합니다.
        container.tokenStore.clear()
        container.guestStore.clearAll()
        container.notificationManager.refresh()
        appContext?.let { ChatNotificationService.stop(it) }
        _state.value = State.Idle
        onDone()

        runCatching { KakaoAuth.logout() }
    }
}
```

실패는 무시해도 됩니다. 서버는 이미 지워진 토큰을 다시 지우라고 해도 성공으로 응답하므로
재시도가 안전하고, 해제에 실패해도 그 토큰은 결국 FCM 이 만료시키면 서버가 알아서 정리합니다.

> 타임아웃 3초 동안 로그아웃 UI 가 멈추는 게 싫다면, `onDone()` 만 먼저 부르고 해제를
> 뒤로 미루는 방법도 있습니다. 다만 그때도 **`clear()` 는 해제 요청이 끝난 뒤**여야 합니다.

**다른 기기는 그대로 남습니다.** 폰에서 로그아웃해도 태블릿은 계속 알림을 받습니다.
서버가 `planUserId + token` 으로 한 행만 지우기 때문입니다.

## 4. `FirebaseMessagingService` — 이미 구현돼 있음

`WeddingPlantMessagingService` 는 지금 상태로 백엔드 페이로드와 맞습니다. 손댈 필요 없습니다.

- `onNewToken` → `registerDeviceToken()` ✅
- `onMessageReceived` → 포그라운드면 토스트, 아니면 `PushNotifier.showChatMessage()` ✅
- 보고 있는 방이면 무시(`currentRoomId`) ✅

## 5. 로그인 직후 토큰 등록 — 이미 구현돼 있음

`PushTokenRegistrar.registerCurrentToken()` 이 그 역할을 합니다.
설치 후 첫 로그인에는 `onNewToken` 이 오지 않으므로 이게 없으면 서버가 그 기기를 영영 모릅니다.

## 6. `local.properties` 에 `USE_FCM=true`

`PushTransport.current` 가 FCM 이 되면 `ChatNotificationService.start()` 가 스스로 아무 일도
하지 않으므로 상시 알림이 사라집니다.

---

## 백엔드가 보내는 페이로드

`notification` 없이 `data` 만 갑니다. `android.priority` 는 `high` 입니다.

```json
{
  "chatRoomId": "1",
  "senderName": "신부",
  "body": "안녕하세요"
}
```

- 값은 **전부 문자열**입니다 (FCM 규칙). `chatRoomId` 도 숫자가 아니라 `"1"`.
- **보낸 사람에게는 가지 않습니다.** 서버가 수신자 목록에서 발신자를 뺍니다.
  앱의 FCM 경로에는 SSE 와 달리 발신자 필터가 없어서 서버가 거릅니다.
- 이름이 없으면 `senderName` 은 `"새 메시지"`, 본문이 없으면 `body` 는 `"메시지가 도착했습니다."`
  로 채워 보냅니다 — 앱의 폴백과 같은 값이라 화면에 나오는 문구가 갈리지 않습니다.

플랜 공유 메시지 본문은 **SSE 경로(`NotificationManager.buildMessage`)와 같은 문구**로 맞췄습니다:

```
플랜을 공유했어요! [스튜디오] 본식 촬영 - 150만원 (2026-09-01)
```

금액이 0 이면 `- N만원` 이, 날짜가 없으면 `(날짜)` 가 빠집니다. 날짜는 `startDate` 앞 10글자입니다.

---

## API 명세

### 등록

```
POST /plan/user/device-token
Authorization: Bearer <앱 JWT>
Content-Type: application/json

{ "token": "<FCM 등록 토큰>", "platform": "ANDROID" }
```

- `platform` 은 `ANDROID` | `IOS`. 값이 다르면 400.
- `token` 은 1~512자.
- 같은 토큰을 다시 보내도 중복 저장되지 않습니다(upsert). 로그인 직후마다 마음 놓고 부르세요.
- 응답 본문은 비어 있습니다. `requestUnit` 은 빈 본문을 성공으로 처리합니다.

### 해제

```
DELETE /plan/user/device-token
Authorization: Bearer <앱 JWT>
Content-Type: application/json

{ "token": "<FCM 등록 토큰>" }
```

- 그 기기 하나만 빠집니다.
- 이미 없는 토큰이어도 성공입니다.
- 남의 토큰은 지워지지 않습니다(소유자까지 조건에 넣어 삭제).

---

## 붙인 뒤 확인할 것

1. 앱을 **완전히 종료**하고 다른 계정으로 메시지 보내기 → 알림이 뜨는가
   (1단계 SSE 로는 안 되던 것 — 이게 되면 전환 성공)
2. **재부팅 후** 앱을 한 번도 열지 않은 상태에서 메시지 → 알림이 뜨는가
3. 채팅방을 보고 있을 때 메시지 → 시스템 알림이 **뜨지 않아야** 함
4. 앱은 켜져 있고 다른 화면 → 인앱 토스트만
5. 내가 보낸 메시지 → 내 기기에 알림이 **뜨지 않아야** 함
6. 로그아웃 후 메시지 → 알림이 **오지 않아야** 함
7. 상시 알림("채팅 알림 대기 중")이 사라졌는가

알림이 안 오면 서버 로그에서 `[FCM]` 을 보세요. 발송 건수와 실패 코드를 남깁니다.

```
[FCM] room: 12 | sent: 1 | failed: 0 | removed: 0
[FCM] failure codes: messaging/registration-token-not-registered
```

`sent: 0` 이면 기기 토큰이 저장되지 않은 것이고(등록 API 호출 확인),
`⚠️ [FCM] service account not configured` 가 부팅 로그에 있으면 서버 환경변수가 빠진 것입니다.
