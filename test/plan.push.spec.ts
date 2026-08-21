import { LoggerService } from '@app/common/log/logger.service';
import { FcmService } from '@app/external/firebase/fcm.service';
import {
  FCM_MULTICAST_MAX_TOKENS,
  FcmSendResultDto,
} from '@app/external/firebase/firebase.dto';
import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import { DevicePlatform } from '@app/repository/enum/plan-user-device-token.enum';
import { PlanUserDeviceTokenRepositoryService } from '@app/repository/service/plan-user-device-token.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanPushService } from 'apps/api/src/module/plen/push/plan-push.service';
import { plainToInstance } from 'class-transformer';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { buildChatPushData } from '../apps/api/src/module/plen/push/plan-push.dto';
import { ChatRoomMemberEntity } from '../libs/repository/src/entity/chat-room-member.entity';
import { ChatRoomEntity } from '../libs/repository/src/entity/chat-room.entity';
import { PlanUserRoomEntity } from '../libs/repository/src/entity/plan-user-room.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('Plan FCM push (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let deviceTokenRepositoryService: PlanUserDeviceTokenRepositoryService;
  let planPushService: PlanPushService;
  let fcmService: FcmService;
  let logger: LoggerService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    deviceTokenRepositoryService = app.get(
      PlanUserDeviceTokenRepositoryService,
    );
    planPushService = app.get(PlanPushService);
    fcmService = app.get(FcmService);
    logger = app.get(LoggerService);
  }, 60_000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await truncateTables(dataSource, [
      'plan_user_device_token',
      'chat_room_member',
      'chat_message',
      'chat_room',
      'plan_user_room',
      'plan_user',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  async function createPlanUser(): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
      }),
    );
  }

  /** 참여자들이 들어가 있는 채팅방을 만든다. */
  async function createChatRoom(memberIds: string[]): Promise<ChatRoomEntity> {
    const planUserRoom = await dataSource
      .getRepository(PlanUserRoomEntity)
      .save(plainToInstance(PlanUserRoomEntity, { ownerId: memberIds[0] }));

    const chatRoom = await dataSource.getRepository(ChatRoomEntity).save(
      plainToInstance(ChatRoomEntity, {
        planUserRoomId: planUserRoom.id,
        name: '테스트 채팅방',
      }),
    );

    await dataSource.getRepository(ChatRoomMemberEntity).save(
      memberIds.map((planUserId) =>
        plainToInstance(ChatRoomMemberEntity, {
          chatRoomId: chatRoom.id,
          planUserId,
        }),
      ),
    );

    return chatRoom;
  }

  function textMessage(planUserId: string, text: string): ChatMessageDto {
    return plainToInstance(ChatMessageDto, {
      id: 1,
      planUserId,
      planUserName: '보낸사람',
      messageType: ChatMessageType.TEXT,
      text,
      createDate: new Date(),
      unreadCount: 1,
    });
  }

  /** FCM 자격증명 없이도 발송 경로를 타도록 클라이언트만 갈아끼운다. */
  function mockFcm(result = FcmSendResultDto.from(1, 0, [])) {
    jest.spyOn(fcmService, 'isConfigured').mockReturnValue(true);

    return jest.spyOn(fcmService, 'sendDataMessage').mockResolvedValue(result);
  }

  // -------------------------------------------------------------------------
  describe('기기 토큰 저장', () => {
    it('같은 토큰을 다시 등록해도 행이 늘지 않는다', async () => {
      // Given - 토큰을 한 번 등록한 유저
      const planUser = await createPlanUser();
      const token = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        planUser.id,
        token,
        DevicePlatform.ANDROID,
      );

      // When - 앱이 로그인 직후 같은 토큰을 다시 보낸다
      await deviceTokenRepositoryService.upsert(
        planUser.id,
        token,
        DevicePlatform.ANDROID,
      );

      // Then - 중복 저장되지 않는다
      const tokens = await deviceTokenRepositoryService.findTokensByPlanUserIds(
        [planUser.id],
      );
      expect(tokens).toEqual([token]);
    });

    it('같은 기기를 다른 계정으로 로그인하면 토큰 소유자가 바뀐다', async () => {
      // Given - A 가 등록해 둔 기기 토큰
      const userA = await createPlanUser();
      const userB = await createPlanUser();
      const token = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        userA.id,
        token,
        DevicePlatform.ANDROID,
      );

      // When - 같은 기기에서 B 가 로그인해 같은 토큰을 등록한다
      await deviceTokenRepositoryService.upsert(
        userB.id,
        token,
        DevicePlatform.ANDROID,
      );

      // Then - A 에게는 더 이상 알림이 가지 않는다
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([userA.id]),
      ).toEqual([]);
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([userB.id]),
      ).toEqual([token]);
    });

    it('로그아웃하면 그 기기의 토큰만 빠진다', async () => {
      // Given - 한 유저가 폰과 태블릿 두 대를 등록
      const planUser = await createPlanUser();
      const phoneToken = faker.string.alphanumeric(64);
      const tabletToken = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        planUser.id,
        phoneToken,
        DevicePlatform.ANDROID,
      );
      await deviceTokenRepositoryService.upsert(
        planUser.id,
        tabletToken,
        DevicePlatform.ANDROID,
      );

      // When - 폰에서만 로그아웃한다
      await deviceTokenRepositoryService.deleteByPlanUserIdAndToken(
        planUser.id,
        phoneToken,
      );

      // Then - 태블릿은 계속 알림을 받는다
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([
          planUser.id,
        ]),
      ).toEqual([tabletToken]);
    });

    it('남의 토큰은 지우지 못한다', async () => {
      // Given - B 가 등록해 둔 토큰
      const userA = await createPlanUser();
      const userB = await createPlanUser();
      const token = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        userB.id,
        token,
        DevicePlatform.ANDROID,
      );

      // When - A 가 그 토큰 값으로 해제를 시도한다
      await deviceTokenRepositoryService.deleteByPlanUserIdAndToken(
        userA.id,
        token,
      );

      // Then - B 의 기기는 그대로 남는다
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([userB.id]),
      ).toEqual([token]);
    });

    it('이미 없는 토큰을 해제해도 실패하지 않는다', async () => {
      // Given - 등록된 적 없는 토큰
      const planUser = await createPlanUser();

      // When/Then - 로그아웃이 이것 때문에 막히면 안 된다
      await expect(
        deviceTokenRepositoryService.deleteByPlanUserIdAndToken(
          planUser.id,
          faker.string.alphanumeric(64),
        ),
      ).resolves.toBeUndefined();
    });

    it('유저 목록이 비면 조회를 건너뛴다', async () => {
      // Given/When/Then - 빈 배열은 그대로 빈 결과
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([]),
      ).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('기기 토큰 API', () => {
    const DEVICE_TOKEN_PATH = '/plan/user/device-token';

    it('등록은 인증을 요구한다 (라우트가 붙어 있다)', async () => {
      // Given/When - 토큰 없이 호출
      const res = await request(app.getHttpServer())
        .post(DEVICE_TOKEN_PATH)
        .send({ token: 'x', platform: DevicePlatform.ANDROID });

      // Then - 404 면 라우트 자체가 없다는 뜻이다
      expect(res.status).toBe(401);
    });

    it('해제도 인증을 요구한다 (라우트가 붙어 있다)', async () => {
      // Given/When - 토큰 없이 호출
      const res = await request(app.getHttpServer())
        .delete(DEVICE_TOKEN_PATH)
        .send({ token: 'x' });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('채팅 푸시 발송', () => {
    it('보낸 사람을 제외한 참여자의 토큰으로만 보낸다', async () => {
      // Given - 두 사람이 참여한 방, 양쪽 모두 기기 토큰 등록
      const sender = await createPlanUser();
      const receiver = await createPlanUser();
      const chatRoom = await createChatRoom([sender.id, receiver.id]);

      const senderToken = faker.string.alphanumeric(64);
      const receiverToken = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        sender.id,
        senderToken,
        DevicePlatform.ANDROID,
      );
      await deviceTokenRepositoryService.upsert(
        receiver.id,
        receiverToken,
        DevicePlatform.ANDROID,
      );

      const sendSpy = mockFcm();

      // When - 보낸 사람이 메시지를 남긴다
      await planPushService.sendChatMessage(
        chatRoom.id,
        textMessage(sender.id, '안녕하세요'),
      );

      // Then - 본인 기기에는 가지 않는다
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [tokens, data] = sendSpy.mock.calls[0];
      expect(tokens).toEqual([receiverToken]);
      expect(data).toEqual({
        chatRoomId: String(chatRoom.id),
        senderName: '보낸사람',
        body: '안녕하세요',
      });
    });

    it('받는 사람의 토큰이 없으면 발송하지 않는다', async () => {
      // Given - 아무도 기기 토큰을 등록하지 않은 방
      const sender = await createPlanUser();
      const receiver = await createPlanUser();
      const chatRoom = await createChatRoom([sender.id, receiver.id]);
      const sendSpy = mockFcm();

      // When
      await planPushService.sendChatMessage(
        chatRoom.id,
        textMessage(sender.id, '안녕하세요'),
      );

      // Then
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('FCM 이 만료라고 답한 토큰은 지운다', async () => {
      // Given - 만료된 토큰 하나를 가진 수신자
      const sender = await createPlanUser();
      const receiver = await createPlanUser();
      const chatRoom = await createChatRoom([sender.id, receiver.id]);
      const deadToken = faker.string.alphanumeric(64);
      await deviceTokenRepositoryService.upsert(
        receiver.id,
        deadToken,
        DevicePlatform.ANDROID,
      );
      mockFcm(FcmSendResultDto.from(0, 1, [deadToken]));

      // When
      await planPushService.sendChatMessage(
        chatRoom.id,
        textMessage(sender.id, '안녕하세요'),
      );

      // Then - 다음 발송부터는 죽은 토큰으로 시도하지 않는다
      expect(
        await deviceTokenRepositoryService.findTokensByPlanUserIds([
          receiver.id,
        ]),
      ).toEqual([]);
    });

    it('발송이 실패해도 예외를 밖으로 던지지 않는다', async () => {
      // Given - 존재하지 않는 방 (채팅 저장 경로를 깨뜨리면 안 된다)
      const sender = await createPlanUser();
      mockFcm();

      // When/Then
      await expect(
        planPushService.sendChatMessage(
          999_999,
          textMessage(sender.id, '안녕하세요'),
        ),
      ).resolves.toBeUndefined();
    });

    it('자격증명이 없으면 아무것도 하지 않는다', async () => {
      // Given - FIREBASE_SERVICE_ACCOUNT 미설정 (테스트 환경 기본값)
      const sender = await createPlanUser();
      const sendSpy = jest.spyOn(fcmService, 'sendDataMessage');

      // When
      await planPushService.sendChatMessage(
        1,
        textMessage(sender.id, '안녕하세요'),
      );

      // Then
      expect(fcmService.isConfigured()).toBe(false);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('푸시 본문 형식', () => {
    it('플랜 공유 메시지는 앱의 SSE 경로와 같은 문구를 만든다', () => {
      // Given - 금액·날짜가 모두 있는 플랜 공유 메시지
      const message = plainToInstance(ChatMessageDto, {
        id: 1,
        planUserId: faker.string.uuid(),
        planUserName: '신부',
        messageType: ChatMessageType.SCHEDULE,
        schedule: {
          id: 1,
          categoryName: '스튜디오',
          title: '본식 촬영',
          amount: 150,
          startDate: '2026-09-01',
        },
        createDate: new Date(),
        unreadCount: 1,
      });

      // When
      const data = buildChatPushData(7, message);

      // Then
      expect(data).toEqual({
        chatRoomId: '7',
        senderName: '신부',
        body: '플랜을 공유했어요! [스튜디오] 본식 촬영 - 150만원 (2026-09-01)',
      });
    });

    it('금액과 날짜가 없으면 그 부분을 빼고 만든다', () => {
      // Given - 금액 0, 날짜 없음
      const message = plainToInstance(ChatMessageDto, {
        id: 1,
        planUserId: faker.string.uuid(),
        planUserName: '신랑',
        messageType: ChatMessageType.SCHEDULE,
        schedule: {
          id: 1,
          categoryName: '드레스',
          title: '가봉',
          amount: 0,
          startDate: null,
        },
        createDate: new Date(),
        unreadCount: 0,
      });

      // When
      const data = buildChatPushData(7, message);

      // Then
      expect(data.body).toBe('플랜을 공유했어요! [드레스] 가봉');
    });

    it('data 값은 모두 문자열이다 (FCM 규칙)', () => {
      // Given - 이름이 없는 발신자의 빈 메시지
      const message = plainToInstance(ChatMessageDto, {
        id: 1,
        planUserId: faker.string.uuid(),
        planUserName: null,
        messageType: ChatMessageType.TEXT,
        text: null,
        createDate: new Date(),
        unreadCount: 0,
      });

      // When
      const data = buildChatPushData(12, message);

      // Then - null 이 새어 나가면 FCM 이 요청 자체를 거절한다
      Object.values(data).forEach((value) =>
        expect(typeof value).toBe('string'),
      );
      expect(data.senderName).toBe('새 메시지');
      expect(data.body).toBe('메시지가 도착했습니다.');
    });
  });
  // -------------------------------------------------------------------------
  describe('FCM 전송 규칙', () => {
    /** sendEachForMulticast 만 흉내 내는 가짜 클라이언트. */
    function fakeMessaging(
      responder: (
        tokens: string[],
      ) => { success: boolean; error?: { code: string } }[],
    ) {
      const calls: string[][] = [];

      const messaging = {
        sendEachForMulticast: (message: { tokens: string[] }) => {
          calls.push(message.tokens);
          const responses = responder(message.tokens);

          return Promise.resolve({
            successCount: responses.filter((v) => v.success).length,
            failureCount: responses.filter((v) => !v.success).length,
            responses,
          });
        },
      };

      return { messaging, calls };
    }

    function tokenList(count: number): string[] {
      return Array.from({ length: count }, (_, i) => `token-${i}`);
    }

    it('500개를 넘는 토큰은 나눠서 보낸다', async () => {
      // Given - FCM 1회 제한을 넘는 토큰 수
      const tokens = tokenList(FCM_MULTICAST_MAX_TOKENS + 1);
      const { messaging, calls } = fakeMessaging((chunk) =>
        chunk.map(() => ({ success: true })),
      );
      const service = new FcmService(messaging as any, logger);

      // When
      const result = await service.sendDataMessage(tokens, { body: 'x' });

      // Then - 500 + 1 로 쪼개진다
      expect(calls.map((chunk) => chunk.length)).toEqual([
        FCM_MULTICAST_MAX_TOKENS,
        1,
      ]);
      expect(result.successCount).toBe(FCM_MULTICAST_MAX_TOKENS + 1);
    });

    it('notification 없이 data 만, android priority high 로 보낸다', async () => {
      // Given - 보낸 메시지를 그대로 붙잡아 둘 가짜 클라이언트
      const sent: any[] = [];
      const messaging = {
        sendEachForMulticast: (message: any) => {
          sent.push(message);

          return Promise.resolve({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }],
          });
        },
      };
      const service = new FcmService(messaging as any, logger);

      // When
      await service.sendDataMessage(['token-0'], { body: 'x' });

      // Then - notification 이 들어가면 앱의 onMessageReceived 가 호출되지 않는다
      expect(sent[0].notification).toBeUndefined();
      expect(sent[0].data).toEqual({ body: 'x' });
      expect(sent[0].android).toEqual({ priority: 'high' });
    });

    it('등록 해제된 토큰만 정리 대상으로 올린다', async () => {
      // Given - 만료 1개, 일시적 실패 1개, 성공 1개
      const { messaging } = fakeMessaging(() => [
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: true },
      ]);
      const service = new FcmService(messaging as any, logger);

      // When
      const result = await service.sendDataMessage(tokenList(3), { body: 'x' });

      // Then - 일시적 실패는 살려 둔다
      expect(result.invalidTokens).toEqual(['token-0']);
    });

    it('청크 전체가 invalid-argument 면 아무 토큰도 지우지 않는다', async () => {
      // Given - 페이로드 버그로 전멸한 상황
      const { messaging } = fakeMessaging((chunk) =>
        chunk.map(() => ({
          success: false,
          error: { code: 'messaging/invalid-argument' },
        })),
      );
      const service = new FcmService(messaging as any, logger);

      // When
      const result = await service.sendDataMessage(tokenList(3), { body: 'x' });

      // Then - 여기서 지우면 버그 한 번에 기기 토큰이 전부 날아간다
      expect(result.invalidTokens).toEqual([]);
      expect(result.hasInvalidTokens()).toBe(false);
    });

    it('일부만 invalid-argument 면 그 토큰은 지운다', async () => {
      // Given - 하나만 형식이 깨진 토큰
      const { messaging } = fakeMessaging(() => [
        { success: true },
        { success: false, error: { code: 'messaging/invalid-argument' } },
      ]);
      const service = new FcmService(messaging as any, logger);

      // When
      const result = await service.sendDataMessage(tokenList(2), { body: 'x' });

      // Then - 다른 토큰은 성공했으니 페이로드 탓이 아니다
      expect(result.invalidTokens).toEqual(['token-1']);
    });

    it('클라이언트가 없으면 발송을 건너뛴다', async () => {
      // Given - 자격증명 미설정
      const service = new FcmService(null, logger);

      // When
      const result = await service.sendDataMessage(['token-0'], { body: 'x' });

      // Then
      expect(result.skipped).toBe(true);
      expect(service.isConfigured()).toBe(false);
    });

    it('발송 중 예외가 나도 결과 객체로 돌려준다', async () => {
      // Given - FCM 호출이 통째로 터지는 상황
      const messaging = {
        sendEachForMulticast: () => Promise.reject(new Error('network down')),
      };
      const service = new FcmService(messaging as any, logger);

      // When
      const result = await service.sendDataMessage(tokenList(2), { body: 'x' });

      // Then - 예외가 호출부로 새지 않는다
      expect(result.failureCount).toBe(2);
      expect(result.invalidTokens).toEqual([]);
    });
  });
});
