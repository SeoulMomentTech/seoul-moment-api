import { DatabaseSort } from '@app/common/enum/global.enum';
import { plainToInstance } from 'class-transformer';

import {
  AdminMemberLikeType,
  AdminMemberProvider,
  AdminMemberStatus,
} from '../enum/admin-member.enum';

/**
 * 회원 목록 조회 조건. 컨트롤러 요청 DTO 와 리포지토리 사이의 계약이다.
 * libs 는 apps 를 참조할 수 없으므로 모양을 여기에 둔다.
 */
export class AdminMemberListFilterDto {
  page?: number;
  count?: number;
  sort?: DatabaseSort;
  search?: string;
  provider?: AdminMemberProvider;
  status?: AdminMemberStatus;
  joinedFrom?: string;
  joinedTo?: string;
  adAgreed?: boolean;
}

/** 회원 한 명의 주문 집계. 목록 한 행에 붙는다. */
export class MemberOrderStatDto {
  /** 전체 주문 건수 (취소·실패 포함) */
  orderCount = 0;

  /** 결제 완료(PAID) 주문의 결제 금액 합 */
  paidAmount = 0;

  /** 마지막 주문 일시 (취소·실패 포함) */
  lastOrderDate: Date | null = null;
}

/**
 * userId -> 주문 집계 모음.
 *
 * raw Map 을 서비스 밖으로 흘리지 않도록 조회 기본값(주문이 없는 회원은 0)
 * 처리를 여기에 가둔다.
 */
export class MemberOrderStatCollectionDto {
  private statMap: Record<number, MemberOrderStatDto> = {};

  static from(
    rows: Array<{
      userId: number | string;
      orderCount: string | number;
      paidAmount: string | number;
      lastOrderDate: Date | string | null;
    }>,
  ): MemberOrderStatCollectionDto {
    const dto = new MemberOrderStatCollectionDto();

    for (const row of rows) {
      dto.statMap[Number(row.userId)] = plainToInstance(MemberOrderStatDto, {
        orderCount: Number(row.orderCount ?? 0),
        paidAmount: Number(row.paidAmount ?? 0),
        lastOrderDate: row.lastOrderDate ? new Date(row.lastOrderDate) : null,
      });
    }

    return dto;
  }

  /** 주문이 한 건도 없는 회원은 0 집계를 돌려준다 */
  getStat(userId: number): MemberOrderStatDto {
    return this.statMap[userId] ?? new MemberOrderStatDto();
  }
}

/** 가입 경로별 회원 수. 요약 카드에 쓴다. */
export class MemberProviderCountDto {
  private countMap: Record<string, number> = {};

  static from(
    rows: Array<{ provider: string | null; count: string | number }>,
  ): MemberProviderCountDto {
    const dto = new MemberProviderCountDto();

    for (const row of rows) {
      const provider = row.provider
        ? (row.provider as AdminMemberProvider)
        : AdminMemberProvider.EMAIL;

      dto.countMap[provider] =
        (dto.countMap[provider] ?? 0) + Number(row.count ?? 0);
    }

    return dto;
  }

  getCount(provider: AdminMemberProvider): number {
    return this.countMap[provider] ?? 0;
  }
}

/** 회원 요약 카드 한 벌 */
export class AdminMemberSummaryDto {
  total = 0;
  newIn7Days = 0;
  withdrawn = 0;
  byProvider: MemberProviderCountDto = MemberProviderCountDto.from([]);
}

/**
 * 좋아요 한 줄. 상품 좋아요와 브랜드 좋아요가 서로 다른 테이블이라
 * UNION 으로 합친 결과를 담는다. 이름은 별도 조회로 채운다.
 */
export class MemberLikeRowDto {
  type: AdminMemberLikeType;
  targetId: number;
  createDate: Date;

  static from(
    rows: Array<{
      type: string;
      target_id: number | string;
      create_date: Date | string;
    }>,
  ): MemberLikeRowDto[] {
    return rows.map((row) =>
      plainToInstance(MemberLikeRowDto, {
        type: row.type as AdminMemberLikeType,
        targetId: Number(row.target_id),
        createDate: new Date(row.create_date),
      }),
    );
  }
}
