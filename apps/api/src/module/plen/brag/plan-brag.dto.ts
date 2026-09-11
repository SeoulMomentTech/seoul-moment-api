import { PlanBragEntity } from '@app/repository/entity/plan-brag.entity';
import {
  PlanBragSort,
  PlanBragStatus,
} from '@app/repository/enum/plan-brag.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

import { daysUntilWedding, toDateString } from './plan-brag.util';

/** 예산 막대·범례 한 줄. 지출 큰 순으로 담는다 */
export interface PlanBragCategoryView {
  categoryName: string;
  /** 실제 지출 (만원) */
  usedAmount: number;
}

/**
 * 상세에 실리는 플랜 한 줄.
 *
 * **시각(startTime)과 메모(memo)는 없다.** 안내 모달이 약속한 공개 범위
 * 밖이다. 장소는 지도를 그리려고 담는다.
 */
export interface PlanBragItemView {
  id: number;
  categoryName: string;
  title: string;
  /** 만원 단위. 안 정했으면 null */
  amount: number | null;
  /** 'YYYY-MM-DD'. 날짜 미정이면 null */
  startDate: string | null;
  /** 'COMPLETED' 면 완료, 그 밖은 예정 — **일정 이야기다** */
  status: string;
  /** 돈이 나갔는지. 일정 완료와 다른 축이다 */
  isPaid: boolean;
  /** 카카오에서 고른 경우 **주소가 아니라 업체명**이다 ("SG웨딩홀") */
  location: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * 볼 때마다 그 사람의 지금 플랜에서 새로 만드는 값.
 *
 * `plan_brag` 에는 "올렸다" 는 사실만 있고 이 값들은 저장하지 않는다 —
 * 켜 둔 뒤에 플랜을 고치면 자랑하기도 같이 바뀌어야 한다.
 */
export interface PlanBragLiveFacts {
  nickname: string;
  weddingDate: Date | string | null;
  totalBudget: number;
  usedAmount: number;
  plannedAmount: number;
  planCount: number;
  doneCount: number;
  categoryChart: PlanBragCategoryView[];
}

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
    description: '남은 일수. 저장값이 아니라 읽을 때 다시 센다',
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
    facts: PlanBragLiveFacts,
    viewerPlanUserId: string,
    likedIds: Set<number>,
    /** 카드 칩 개수. 그 이상은 카드가 두 줄이 되어 벽돌이 흐트러진다 */
    chipCount = 5,
  ): GetPlanBragResponse {
    const response = new GetPlanBragResponse();
    response.bragId = entity.id;
    response.nickname = facts.nickname;
    response.weddingDate = toDateString(facts.weddingDate);
    response.dday = daysUntilWedding(facts.weddingDate);
    response.totalBudget = facts.totalBudget;
    response.usedAmount = facts.usedAmount;
    response.plannedAmount = facts.plannedAmount;
    response.planCount = facts.planCount;
    response.doneCount = facts.doneCount;
    response.categories = facts.categoryChart
      .slice(0, chipCount)
      .map((row) => row.categoryName);
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
  categoryChart: PlanBragCategoryView[];

  @ApiProperty({
    description:
      '플랜 전체를 **평평한 목록**으로. 카테고리로 묶고 소계를 내는 일은 ' +
      '앱이 한다 — 소계는 지출과 예정을 함께 세야 하는데 그 규칙을 서버에 ' +
      '두면 문구 하나 고치는 데 배포가 묶인다',
  })
  items: PlanBragItemView[];

  static fromDetail(
    entity: PlanBragEntity,
    facts: PlanBragLiveFacts,
    items: PlanBragItemView[],
    viewerPlanUserId: string,
    likedIds: Set<number>,
  ): GetPlanBragDetailResponse {
    const response = Object.assign(
      new GetPlanBragDetailResponse(),
      GetPlanBragResponse.from(entity, facts, viewerPlanUserId, likedIds),
    );
    response.categoryChart = facts.categoryChart;
    response.items = items;
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
