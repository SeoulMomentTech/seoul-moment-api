import { PlanFeedPostEntity } from '@app/repository/entity/plan-feed-post.entity';
import {
  PlanFeedAuthorRole,
  PlanFeedSort,
  PlanFeedVoteValue,
} from '@app/repository/enum/plan-feed.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GetPlanFeedListRequest {
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

  @ApiPropertyOptional({ description: '카테고리 이름', example: '스드메' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: '지역. 앞에서부터 맞춰 거른다 ("서울" 이면 서울 전체)',
    example: '서울 강남구',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: '최소 금액 (만원)', example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @ApiPropertyOptional({ description: '최대 금액 (만원)', example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: '정렬',
    enum: PlanFeedSort,
    default: PlanFeedSort.RECENT,
  })
  @IsOptional()
  @IsEnum(PlanFeedSort)
  sort?: PlanFeedSort = PlanFeedSort.RECENT;
}

export class PostPlanFeedRequest {
  @ApiPropertyOptional({
    description:
      '옮겨 담을 일정 id. 주면 카테고리·업체명·금액·지역을 그 일정에서 가져온다',
    example: 17,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  scheduleId?: number;

  @ApiPropertyOptional({ description: '카테고리 (일정 없이 직접 쓸 때)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryName?: string;

  @ApiPropertyOptional({ description: '업체명 (일정 없이 직접 쓸 때)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: '금액 (만원, 일정 없이 직접 쓸 때)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description:
      '카카오 장소 id. 같은 업체 후기를 묶는 열쇠라, 고른 경우 반드시 함께 보낸다',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  placeId?: string;

  @ApiPropertyOptional({
    description:
      '카카오 장소 이름. 주면 업체명으로 쓴다 — 일정 제목은 "본식 촬영" 같은 개인 메모인 경우가 많다',
    example: 'SG웨딩홀',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeName?: string;

  @ApiPropertyOptional({
    description: '도로명 주소. 이 값에서 시/구를 잘라 region 을 만든다',
    example: '서울 강남구 테헤란로 152',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: '위도', example: 37.5006 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ description: '경도', example: 127.0364 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiProperty({ description: '만족도 1~5', example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiPropertyOptional({
    description: '한 줄 후기',
    example: '주차가 넉넉해요',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @ApiPropertyOptional({
    description: '금액 공개 여부. 거짓이면 응답에서 금액을 아예 뺀다',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isAmountPublic?: boolean = true;

  @ApiPropertyOptional({
    description: '신랑/신부. 익명 표시("D-131 신부")에 쓴다',
    enum: PlanFeedAuthorRole,
    default: PlanFeedAuthorRole.UNKNOWN,
  })
  @IsOptional()
  @IsEnum(PlanFeedAuthorRole)
  authorRole?: PlanFeedAuthorRole;
}

/**
 * 피드에 실리는 후기.
 *
 * **planUserId 를 절대 담지 않는다.** 익명 피드인데 작성자 id 가 실리면
 * 같은 id 의 글을 모아 한 사람의 지출을 통째로 재구성할 수 있다. 화면에
 * 쓰는 "D-131 신부" 문장은 authorDDay·authorRole 로 앱이 조립한다
 * (활동 기록과 같은 규칙 — 문구가 백엔드 배포에 묶이지 않게).
 */
export class GetPlanFeedResponse {
  @ApiProperty({ description: '후기 id', example: 42 })
  id: number;

  @ApiProperty({ description: '카테고리', example: '스드메' })
  categoryName: string;

  @ApiProperty({ description: '업체명', example: '아뜰리에 진' })
  title: string;

  @ApiPropertyOptional({
    description: '실제 지출 (만원). 비공개면 이 필드가 아예 없다',
    example: 385,
  })
  amount?: number;

  @ApiProperty({ description: '금액을 공개했는지', example: true })
  isAmountPublic: boolean;

  @ApiPropertyOptional({ description: '지역 (시/구)', example: '서울 강남구' })
  region: string | null;

  @ApiPropertyOptional({
    description: '도로명 주소. 카카오 장소를 고른 경우에만 있다',
    example: '서울 강남구 테헤란로 152',
  })
  address: string | null;

  @ApiPropertyOptional({ description: '카카오 장소 id' })
  placeId: string | null;

  @ApiPropertyOptional({ description: '위도. 카카오맵 링크에 쓴다' })
  lat: number | null;

  @ApiPropertyOptional({ description: '경도. 카카오맵 링크에 쓴다' })
  lng: number | null;

  @ApiProperty({ description: '만족도 1~5', example: 5 })
  rating: number;

  @ApiPropertyOptional({ description: '한 줄 후기' })
  body: string | null;

  @ApiPropertyOptional({
    description: '올린 시점의 남은 일수. 앱이 "D-131" 로 적는다',
    example: 131,
  })
  authorDDay: number | null;

  @ApiProperty({
    description: '신랑/신부',
    enum: PlanFeedAuthorRole,
    example: PlanFeedAuthorRole.BRIDE,
  })
  authorRole: PlanFeedAuthorRole;

  @ApiProperty({
    description: '"도움이 돼요" 수. 안 돼요 수는 내보내지 않는다',
    example: 24,
  })
  helpfulCount: number;

  @ApiPropertyOptional({
    description: '내가 어떻게 평가했는지. 안 했으면 null',
    enum: PlanFeedVoteValue,
    example: PlanFeedVoteValue.HELPFUL,
  })
  myVote: PlanFeedVoteValue | null;

  @ApiProperty({ description: '내가 올린 글인지', example: false })
  isMine: boolean;

  @ApiProperty({ description: '올린 시각' })
  createDate: Date;

  static from(
    entity: PlanFeedPostEntity,
    viewerPlanUserId: string,
    myVotes: Map<number, PlanFeedVoteValue>,
  ): GetPlanFeedResponse {
    const response = new GetPlanFeedResponse();
    response.id = entity.id;
    response.categoryName = entity.categoryName;
    response.title = entity.title;
    // 비공개면 0 이나 null 이 아니라 필드 자체를 뺀다. null 로 내리면
    // 클라이언트가 "0원" 으로 그리는 실수를 한다.
    if (entity.isAmountPublic && entity.amount !== null) {
      response.amount = entity.amount;
    }
    response.isAmountPublic = entity.isAmountPublic;
    response.region = entity.region;
    response.address = entity.address;
    response.placeId = entity.placeId;
    // decimal 은 드라이버가 문자열로 준다. 지도 링크에 그대로 넣으면 깨진다
    response.lat = entity.lat === null ? null : Number(entity.lat);
    response.lng = entity.lng === null ? null : Number(entity.lng);
    response.rating = entity.rating;
    response.body = entity.body;
    response.authorDDay = entity.authorDDay;
    response.authorRole = entity.authorRole;
    response.helpfulCount = entity.helpfulCount;
    // notHelpfulCount 는 의도적으로 뺀다 — 공개하면 정직한 후기가 안 올라온다
    response.myVote = myVotes.get(entity.id) ?? null;
    response.isMine = entity.planUserId === viewerPlanUserId;
    response.createDate = entity.createDate;
    return response;
  }
}

export class PostPlanFeedVoteRequest {
  @ApiProperty({
    description: '평가. 같은 값을 다시 보내면 취소된다',
    enum: PlanFeedVoteValue,
    example: PlanFeedVoteValue.HELPFUL,
  })
  @IsEnum(PlanFeedVoteValue)
  value: PlanFeedVoteValue;
}

export class PlanFeedVoteResponse {
  @ApiPropertyOptional({
    description: '누른 뒤 내 평가. 취소했으면 null',
    enum: PlanFeedVoteValue,
  })
  myVote: PlanFeedVoteValue | null;

  @ApiProperty({ description: '누른 뒤 "도움이 돼요" 수', example: 25 })
  helpfulCount: number;
}

/** 피드 사이드의 "내 후기" 패널 */
export class GetPlanFeedMyStatusResponse {
  @ApiProperty({ description: '내가 올린 후기 수', example: 2 })
  postCount: number;

  @ApiProperty({
    description: '내 후기가 받은 "도움이 돼요" 총합',
    example: 17,
  })
  receivedHelpfulCount: number;

  @ApiProperty({ description: '완료했는데 아직 안 올린 일정 수', example: 3 })
  postableScheduleCount: number;
}

/** 아직 후기로 안 올린 완료 일정 */
export class GetPostableScheduleResponse {
  @ApiProperty({ description: '일정 id', example: 17 })
  scheduleId: number;

  @ApiProperty({ description: '카테고리', example: '스드메' })
  categoryName: string;

  @ApiProperty({ description: '제목(업체명)', example: '아뜰리에 진' })
  title: string;

  @ApiPropertyOptional({ description: '금액 (만원)', example: 385 })
  amount: number | null;

  @ApiPropertyOptional({
    description:
      '일정에 적힌 장소. 카카오 검색에서 고른 경우 주소가 아니라 **업체명**이다',
    example: 'SG웨딩홀',
  })
  location: string | null;

  @ApiPropertyOptional({ description: '위도' })
  locationLat: number | null;

  @ApiPropertyOptional({ description: '경도' })
  locationLng: number | null;

  @ApiPropertyOptional({ description: '날짜' })
  startDate: Date | null;
}
