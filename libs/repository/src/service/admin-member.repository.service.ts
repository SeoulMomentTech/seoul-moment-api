import { DatabaseSort } from '@app/common/enum/global.enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import {
  AdminMemberListFilterDto,
  AdminMemberSummaryDto,
  MemberLikeRowDto,
  MemberOrderStatCollectionDto,
  MemberProviderCountDto,
} from '../dto/admin-member.dto';
import { OrderEntity } from '../entity/order.entity';
import { ProductItemEntity } from '../entity/product-item.entity';
import { UserProductLikeEntity } from '../entity/user-product-like.entity';
import { UserEntity } from '../entity/user.entity';
import {
  AdminMemberLikeType,
  AdminMemberProvider,
  AdminMemberStatus,
} from '../enum/admin-member.enum';
import { OrderStatus } from '../enum/order.enum';

/** 요약 카드의 "신규" 기준 일수 */
const NEW_MEMBER_DAYS = 7;

/**
 * 어드민 회원 관리 전용 조회.
 *
 * 사용자 본인용(`UserRepositoryService`)과 분리한 이유는 두 가지다.
 * 1. 어드민만 탈퇴 회원(`withDeleted`)을 본다 — 사용자 경로에 섞이면 위험하다.
 * 2. 가입 경로·주문 집계처럼 어드민 화면에만 필요한 조인이 붙는다.
 */
@Injectable()
export class AdminMemberRepositoryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,

    @InjectRepository(UserProductLikeEntity)
    private readonly userProductLikeRepository: Repository<UserProductLikeEntity>,

    @InjectRepository(ProductItemEntity)
    private readonly productItemRepository: Repository<ProductItemEntity>,
  ) {}

  async getMemberList(
    filter: AdminMemberListFilterDto,
  ): Promise<[UserEntity[], number]> {
    const page = filter.page ?? 1;
    const count = filter.count ?? 10;
    const query = this.buildListQuery(filter);

    return query
      .skip((page - 1) * count)
      .take(count)
      .orderBy('u.createDate', filter.sort ?? DatabaseSort.DESC)
      .getManyAndCount();
  }

  /**
   * 탈퇴 회원도 조회된다. 운영자가 "이 계정 어떻게 됐나"를 확인해야 하고,
   * 탈퇴 회원의 주문 기록은 그대로 남아 있기 때문이다.
   */
  async findMemberDetail(userId: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: { profile: { image: true }, fit: true, sns: true },
      withDeleted: true,
    });
  }

  async updateAgreement(
    userId: number,
    values: Partial<
      Pick<UserEntity, 'newProductDate' | 'adAgreeDate' | 'recommendDate'>
    >,
  ): Promise<void> {
    await this.userRepository.update({ id: userId }, values);
  }

  async getSummary(): Promise<AdminMemberSummaryDto> {
    const newSince = new Date();
    newSince.setUTCDate(newSince.getUTCDate() - NEW_MEMBER_DAYS);

    const [total, newIn7Days, withdrawn, providerRows] = await Promise.all([
      this.userRepository.count(),
      this.userRepository
        .createQueryBuilder('u')
        .where('u.createDate >= :newSince', { newSince })
        .getCount(),
      this.userRepository
        .createQueryBuilder('u')
        .withDeleted()
        .where('u.deleteDate IS NOT NULL')
        .getCount(),
      this.getProviderCountRows(),
    ]);

    const summary = new AdminMemberSummaryDto();
    summary.total = total;
    summary.newIn7Days = newIn7Days;
    summary.withdrawn = withdrawn;
    summary.byProvider = MemberProviderCountDto.from(providerRows);

    return summary;
  }

  /**
   * 회원별 주문 집계. 목록 한 페이지분의 userId 만 넘겨 N+1 을 피한다.
   *
   * `orderCount` 는 취소·실패를 포함한 전체 건수, `paidAmount` 는 결제 완료
   * 주문만 더한 금액이다. 두 숫자의 기준이 다르다는 것을 화면에 표기해야 한다.
   */
  async getOrderStats(
    userIds: number[],
  ): Promise<MemberOrderStatCollectionDto> {
    if (userIds.length === 0) {
      return MemberOrderStatCollectionDto.from([]);
    }

    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.userId', 'userId')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status = :paid THEN o.totalAmount ELSE 0 END), 0)',
        'paidAmount',
      )
      .addSelect('MAX(o.createDate)', 'lastOrderDate')
      .where('o.userId IN (:...userIds)', { userIds })
      .setParameter('paid', OrderStatus.PAID)
      .groupBy('o.userId')
      .getRawMany();

    return MemberOrderStatCollectionDto.from(rows);
  }

  async getMemberOrderList(
    userId: number,
    page: number,
    count: number,
    status?: OrderStatus,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[OrderEntity[], number]> {
    const query = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'oi')
      .where('o.userId = :userId', { userId });

    if (status) {
      query.andWhere('o.status = :status', { status });
    }

    return query
      .skip((page - 1) * count)
      .take(count)
      .orderBy('o.createDate', sort)
      .getManyAndCount();
  }

  /**
   * 상품 좋아요와 브랜드 좋아요를 한 목록으로 섞는다.
   *
   * 두 테이블을 각각 조회해 메모리에서 합치면 페이지 경계가 어긋나므로
   * UNION ALL 로 DB 에서 정렬·페이징한다. 이름은 호출하는 쪽에서 채운다.
   */
  async getMemberLikeList(
    userId: number,
    page: number,
    count: number,
    type?: AdminMemberLikeType,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[MemberLikeRowDto[], number]> {
    const source = this.buildLikeSourceSql(type);
    const offset = (page - 1) * count;
    // sort 는 DatabaseSort 로 검증된 값만 들어온다. 문자열을 그대로 잇는 곳은 여기뿐이다
    const direction = sort === DatabaseSort.ASC ? 'ASC' : 'DESC';

    const [rows, countRows] = await Promise.all([
      this.userProductLikeRepository.manager.query(
        `${source} ORDER BY create_date ${direction} LIMIT $2 OFFSET $3`,
        [userId, count, offset],
      ),
      this.userProductLikeRepository.manager.query(
        `SELECT COUNT(*)::int AS total FROM (${source}) AS t`,
        [userId],
      ),
    ]);

    return [MemberLikeRowDto.from(rows), Number(countRows[0]?.total ?? 0)];
  }

  /** 좋아요 목록의 상품명·이미지를 채우기 위해 한 번에 끌어온다 */
  async findProductItemsByIds(ids: number[]): Promise<ProductItemEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.productItemRepository
      .createQueryBuilder('pi')
      .leftJoinAndSelect('pi.product', 'p')
      .where('pi.id IN (:...ids)', { ids })
      .getMany();
  }

  /** 타입이 지정되면 해당 테이블만, 아니면 둘을 UNION ALL 한다 */
  private buildLikeSourceSql(type?: AdminMemberLikeType): string {
    const productSql = `SELECT 'PRODUCT' AS type, product_item_id AS target_id, create_date FROM user_product_like WHERE user_id = $1`;
    const brandSql = `SELECT 'BRAND' AS type, brand_id AS target_id, create_date FROM user_brand_like WHERE user_id = $1`;

    if (type === AdminMemberLikeType.PRODUCT) {
      return productSql;
    }

    if (type === AdminMemberLikeType.BRAND) {
      return brandSql;
    }

    return `${productSql} UNION ALL ${brandSql}`;
  }

  private async getProviderCountRows(): Promise<
    Array<{ provider: string | null; count: string }>
  > {
    return this.userRepository
      .createQueryBuilder('u')
      .leftJoin('u.sns', 's')
      .select('s.provider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.provider')
      .getRawMany();
  }

  private buildListQuery(
    filter: AdminMemberListFilterDto,
  ): SelectQueryBuilder<UserEntity> {
    const query = this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('u.sns', 's');

    this.applyStatusFilter(query, filter.status);
    this.applySearchFilter(query, filter.search);
    this.applyProviderFilter(query, filter.provider);
    this.applyJoinedFilter(query, filter.joinedFrom, filter.joinedTo);
    this.applyAdAgreedFilter(query, filter.adAgreed);

    return query;
  }

  /** 기본은 활성 회원만. WITHDRAWN 을 명시했을 때만 소프트 삭제를 꺼낸다 */
  private applyStatusFilter(
    query: SelectQueryBuilder<UserEntity>,
    status?: AdminMemberStatus,
  ): void {
    if (status !== AdminMemberStatus.WITHDRAWN) {
      return;
    }

    query.withDeleted().andWhere('u.deleteDate IS NOT NULL');
  }

  /** 한 칸으로 이메일·닉네임·전화번호·이름을 훑는다 */
  private applySearchFilter(
    query: SelectQueryBuilder<UserEntity>,
    search?: string,
  ): void {
    if (!search) {
      return;
    }

    query.andWhere(
      '(u.email ILIKE :search OR u.nickname ILIKE :search OR u.phone ILIKE :search OR p.name ILIKE :search)',
      { search: `%${search}%` },
    );
  }

  /** EMAIL 은 "user_sns 행이 없음" 이다 */
  private applyProviderFilter(
    query: SelectQueryBuilder<UserEntity>,
    provider?: AdminMemberProvider,
  ): void {
    if (!provider) {
      return;
    }

    if (provider === AdminMemberProvider.EMAIL) {
      query.andWhere('s.user_id IS NULL');

      return;
    }

    query.andWhere('s.provider = :provider', { provider });
  }

  /** 날짜만 받아 하루 끝까지 포함시킨다. 기준 시각은 UTC 다 */
  private applyJoinedFilter(
    query: SelectQueryBuilder<UserEntity>,
    joinedFrom?: string,
    joinedTo?: string,
  ): void {
    if (joinedFrom) {
      query.andWhere('u.createDate >= :joinedFrom', {
        joinedFrom: new Date(`${joinedFrom}T00:00:00.000Z`),
      });
    }

    if (joinedTo) {
      query.andWhere('u.createDate <= :joinedTo', {
        joinedTo: new Date(`${joinedTo}T23:59:59.999Z`),
      });
    }
  }

  private applyAdAgreedFilter(
    query: SelectQueryBuilder<UserEntity>,
    adAgreed?: boolean,
  ): void {
    if (adAgreed === undefined) {
      return;
    }

    query.andWhere(
      adAgreed ? 'u.adAgreeDate IS NOT NULL' : 'u.adAgreeDate IS NULL',
    );
  }
}
