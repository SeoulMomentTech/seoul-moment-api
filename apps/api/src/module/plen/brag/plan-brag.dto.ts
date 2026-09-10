import {
  PlanBragCategorySnapshot,
  PlanBragEntity,
  PlanBragItemSnapshot,
} from '@app/repository/entity/plan-brag.entity';
import {
  PlanBragSort,
  PlanBragStatus,
} from '@app/repository/enum/plan-brag.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

import { daysUntilWedding, toDateString } from './plan-brag.util';

export class GetPlanBragListRequest {
  @ApiPropertyOptional({ description: '페이지 번호', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', example: 20, default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  count?: number = 20;

  @ApiPropertyOptional({
    description: '정렬',
    enum: PlanBragSort,
    default: PlanBragSort.RECENT,
  })
  @IsOptional()
  @IsEnum(PlanBragSort)
  sort?: PlanBragSort = PlanBragSort.RECENT;
}

/**
 * 목록 카드 한 장.
 *
 * **여기 담기는 것은 앱의 안내 모달이 글자 그대로 약속한 범위 안이어야 한다.**
 * 넓히려면 `BragToggle` 의 OPEN_FIELDS 를 먼저 고친다 — 순서를 뒤집으면
 * 동의받지 않은 것을 공개하게 된다.
 */
export class GetPlanBragResponse {
  @ApiProperty({ example: 12 })
  bragId: number;

  @ApiProperty({ description: '"지수 · 현우"', example: '지수 · 현우' })
  nickname: string;

  @ApiProperty({ example: '2026-11-14', nullable: true })
  weddingDate: string | null;

  @ApiProperty({
    description:
      '남은 일수. **저장값이 아니라 읽을 때 다시 센다** — 스냅샷이라고 ' +
      'D-24 를 박아 두면 반년 뒤에도 D-24 라고 적힌다',
    example: 66,
    nullable: true,
  })
  dday: number | null;

  @ApiProperty({ description: '총예산 (만원)', example: 4200 })
  totalBudget: number;

  @ApiProperty({ description: '실제 지출 (만원)', example: 1340 })
  usedAmount: number;

  @ApiProperty({ description: '아직 안 쓴 예정 몫 (만원)', example: 1850 })
  plannedAmount: number;

  @ApiProperty({ example: 18 })
  planCount: number;

  @ApiProperty({ example: 11 })
  doneCount: number;

  @ApiProperty({ description: '카드의 칩. 지출 큰 순', type: [String] })
  categories: string[];

  @ApiProperty({ example: 24 })
  likeCount: number;

  @ApiProperty({ description: '요청한 사람이 눌렀는지' })
  liked: boolean;

  @ApiProperty({ nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ description: '참이면 앱이 좋아요 대신 내려두기를 낸다' })
  isMine: boolean;

  static from(
    entity: PlanBragEntity,
    viewerPlanUserId: string,
    likedIds: Set<number>,
  ): GetPlanBragResponse {
    const response = new GetPlanBragResponse();
    response.bragId = entity.id;
    response.nickname = entity.nickname;
    response.weddingDate = toDateString(entity.weddingDate);
    response.dday = daysUntilWedding(entity.weddingDate);
    response.totalBudget = entity.totalBudget;
    response.usedAmount = entity.usedAmount;
    response.plannedAmount = entity.plannedAmount;
    response.planCount = entity.planCount;
    response.doneCount = entity.doneCount;
    response.categories = entity.categories ?? [];
    response.likeCount = entity.likeCount;
    response.liked = likedIds.has(entity.id);
    response.publishedAt = entity.publishedAt;
    response.isMine = entity.planUserId === viewerPlanUserId;
    return response;
  }
}

/** 상세 모달(M5-C). 목록 카드에 예산 막대와 플랜 목록이 더해진다 */
export class GetPlanBragDetailResponse extends GetPlanBragResponse {
  @ApiProperty({
    description: '예산 막대·범례. 지출 큰 순. 앱은 상위 4개에만 색을 준다',
  })
  categoryChart: PlanBragCategorySnapshot[];

  @ApiProperty({
    description:
      '플랜 전체를 **평평한 목록**으로. 카테고리로 묶고 소계를 내는 일은 ' +
      '앱이 한다 — 소계는 지출과 예정을 함께 세야 하는데 그 규칙을 서버에 ' +
      '두면 문구 하나 고치는 데 배포가 묶인다',
  })
  items: PlanBragItemSnapshot[];

  static fromDetail(
    entity: PlanBragEntity,
    viewerPlanUserId: string,
    likedIds: Set<number>,
  ): GetPlanBragDetailResponse {
    const response = Object.assign(
      new GetPlanBragDetailResponse(),
      GetPlanBragResponse.from(entity, viewerPlanUserId, likedIds),
    );
    response.categoryChart = entity.categoryChart ?? [];
    response.items = entity.items ?? [];
    return response;
  }
}

/** 대시보드 토글의 상태 */
export class GetPlanBragMyStatusResponse {
  @ApiProperty({ description: '지금 올라가 있는지' })
  published: boolean;

  @ApiProperty({ nullable: true })
  bragId: number | null;

  @ApiProperty({ nullable: true })
  publishedAt: Date | null;

  @ApiProperty({
    description: '내려가 있어도 받은 수는 남는다 — 다시 올리면 그대로 이어진다',
    example: 24,
  })
  likeCount: number;

  static from(entity: PlanBragEntity | null): GetPlanBragMyStatusResponse {
    const response = new GetPlanBragMyStatusResponse();
    const published = entity?.status === PlanBragStatus.PUBLISHED;
    response.published = published;
    response.bragId = published ? (entity?.id ?? null) : null;
    response.publishedAt = published ? (entity?.publishedAt ?? null) : null;
    response.likeCount = entity?.likeCount ?? 0;
    return response;
  }
}

export class PostPlanBragResponse {
  @ApiProperty({ example: 12 })
  bragId: number;
}

/**
 * 좋아요 응답.
 *
 * 앱이 **낙관적으로** 그린다 — 누르는 즉시 숫자를 바꾸고 응답이 오면 서버
 * 값으로 맞춘다. 그래서 **최종 likeCount 를 반드시 실어 준다.**
 */
export class PlanBragLikeResponse {
  @ApiProperty({ example: 25 })
  likeCount: number;

  @ApiProperty()
  liked: boolean;
}
