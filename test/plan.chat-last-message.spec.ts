import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanUserService } from 'apps/api/src/module/plen/user/plan-user.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { ChatMessageEntity } from '../libs/repository/src/entity/chat-message.entity';
import { ChatRoomMemberEntity } from '../libs/repository/src/entity/chat-room-member.entity';
import { ChatRoomEntity } from '../libs/repository/src/entity/chat-room.entity';
import { PlanUserRoomEntity } from '../libs/repository/src/entity/plan-user-room.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('대화 목록의 마지막 메시지 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userService: PlanUserService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    userService = app.get(PlanUserService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'chat_message',
      'chat_room_member',
      'chat_room',
      'plan_user_room_member',
      'plan_user_room',
      'plan_user',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function createUser(): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 1000,
      }),
    );
  }

  /** 채팅방은 플랜 방(plan_user_room)에 매달려 있다 */
  async function createPlanRoom(owner: PlanUserEntity) {
    return dataSource
      .getRepository(PlanUserRoomEntity)
      .save(plainToInstance(PlanUserRoomEntity, { ownerId: owner.id }));
  }

  async function createRoom(
    user: PlanUserEntity,
    name: string,
    planRoomId?: number,
  ): Promise<ChatRoomEntity> {
    const planUserRoomId = planRoomId ?? (await createPlanRoom(user)).id;
    const room = await dataSource
      .getRepository(ChatRoomEntity)
      .save(plainToInstance(ChatRoomEntity, { name, planUserRoomId }));
    await dataSource.getRepository(ChatRoomMemberEntity).save(
      plainToInstance(ChatRoomMemberEntity, {
        chatRoomId: room.id,
        planUserId: user.id,
      }),
    );
    return room;
  }

  async function say(
    room: ChatRoomEntity,
    user: PlanUserEntity,
    text: string | null,
    type: ChatMessageType = ChatMessageType.TEXT,
  ) {
    return dataSource.getRepository(ChatMessageEntity).save(
      plainToInstance(ChatMessageEntity, {
        chatRoomId: room.id,
        planUserId: user.id,
        message: text === null ? { scheduleId: 1 } : { text, scheduleId: 0 },
        messageType: type,
      }),
    );
  }

  it('방마다 가장 최근 메시지를 하나씩 준다', async () => {
    // Given
    // plan_user_room 은 소유자당 하나다. 채팅방 둘을 같은 방에 매단다.
    const user = await createUser();
    const planRoom = await createPlanRoom(user);
    const a = await createRoom(user, '스드메', planRoom.id);
    const b = await createRoom(user, '예물 · 예단', planRoom.id);
    await say(a, user, '첫 메시지');
    await say(a, user, '마지막 메시지');
    await say(b, user, '다른 방 메시지');

    // When
    const rooms = await userService.getUserChatRoomList(user.id);

    // Then
    const byName = new Map(rooms.map((r) => [r.name, r]));
    expect(byName.get('스드메')?.lastMessage).toBe('마지막 메시지');
    expect(byName.get('예물 · 예단')?.lastMessage).toBe('다른 방 메시지');
    expect(byName.get('스드메')?.lastMessageDate).toBeTruthy();
  });

  it('메시지가 없는 방은 null 이다', async () => {
    // Given
    const user = await createUser();
    await createRoom(user, '조용한 방');

    // When
    const rooms = await userService.getUserChatRoomList(user.id);

    // Then
    expect(rooms[0].lastMessage).toBeNull();
    expect(rooms[0].lastMessageDate).toBeNull();
  });

  it('플랜 공유 메시지는 문구를 지어내지 않고 null 을 준다', async () => {
    // Given - message.text 가 비어 있는 타입이다
    const user = await createUser();
    const room = await createRoom(user, '본식 준비');
    await say(room, user, null, ChatMessageType.SCHEDULE);

    // When
    const rooms = await userService.getUserChatRoomList(user.id);

    // Then
    expect(rooms[0].lastMessage).toBeNull();
  });

  it('내가 속하지 않은 방은 목록에 없다', async () => {
    // Given
    const me = await createUser();
    const other = await createUser();
    await createRoom(me, '내 방');
    const notMine = await createRoom(other, '남의 방');
    await say(notMine, other, '보이면 안 되는 메시지');

    // When
    const rooms = await userService.getUserChatRoomList(me.id);

    // Then
    expect(rooms.map((r) => r.name)).toEqual(['내 방']);
  });
});
