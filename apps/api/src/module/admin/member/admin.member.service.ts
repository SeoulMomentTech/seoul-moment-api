import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { MemberLikeRowDto } from '@app/repository/dto/admin-member.dto';
import { CartItemEntity } from '@app/repository/entity/cart-item.entity';
import { UserEntity } from '@app/repository/entity/user.entity';
import { AdminMemberLikeType } from '@app/repository/enum/admin-member.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { AdminMemberRepositoryService } from '@app/repository/service/admin-member.repository.service';
import { CartRepositoryService } from '@app/repository/service/cart.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { UserRecentRepositoryService } from '@app/repository/service/user.recent.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetAdminMemberCartResponse,
  GetAdminMemberLikeListRequest,
  GetAdminMemberLikeResponse,
  GetAdminMemberListRequest,
  GetAdminMemberListResponse,
  GetAdminMemberOrderListRequest,
  GetAdminMemberOrderListResponse,
  GetAdminMemberRecentResponse,
  GetAdminMemberResponse,
  GetAdminMemberSummaryResponse,
  MultilingualNameCollectionDto,
  PatchAdminMemberAgreementRequest,
} from './admin.member.dto';
import { OptionTextCollectionDto } from '../../user/cart/user.cart.dto';
import { UserWithdrawService } from '../../user/withdraw/user.withdraw.service';
import { ListSimpleFilterDto } from '../admin.dto';

@Injectable()
export class AdminMemberService {
  constructor(
    private readonly adminMemberRepositoryService: AdminMemberRepositoryService,
    private readonly cartRepositoryService: CartRepositoryService,
    private readonly userRecentRepositoryService: UserRecentRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly userWithdrawService: UserWithdrawService,
  ) {}

  /** 관리자 강제 탈퇴. 유저 본인 탈퇴와 동일한 처리를 수행한다. */
  async withdrawMember(userId: number): Promise<void> {
    await this.userWithdrawService.withdraw(userId);
  }

  /**
   * 목록 한 페이지를 뽑고, 그 페이지의 회원들만 주문을 집계해 붙인다.
   * 회원 수만큼 집계 쿼리를 돌리지 않기 위해 두 번의 조회로 끝낸다.
   */
  async getMemberList(
    query: GetAdminMemberListRequest,
  ): Promise<[GetAdminMemberListResponse[], number]> {
    const [users, total] =
      await this.adminMemberRepositoryService.getMemberList(query);
    const stats = await this.adminMemberRepositoryService.getOrderStats(
      users.map((user) => user.id),
    );

    return [
      users.map((user) =>
        GetAdminMemberListResponse.from(user, stats.getStat(user.id)),
      ),
      total,
    ];
  }

  async getSummary(): Promise<GetAdminMemberSummaryResponse> {
    const summary = await this.adminMemberRepositoryService.getSummary();

    return GetAdminMemberSummaryResponse.from(summary);
  }

  async getMember(userId: number): Promise<GetAdminMemberResponse> {
    const user = await this.getMemberOrThrow(userId);

    return GetAdminMemberResponse.from(user);
  }

  /**
   * 마케팅 수신 동의만 바꾼다. boolean 을 받아 서버가 일시를 채우거나 지운다.
   * 이용약관·개인정보 동의 일시는 가입 시점 기록이라 손대지 않는다.
   */
  async updateAgreement(
    userId: number,
    body: PatchAdminMemberAgreementRequest,
  ): Promise<void> {
    if (body.isEmpty()) {
      throw new ServiceError(
        'No agreement field to update',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    await this.getMemberOrThrow(userId);

    const now = new Date();
    const values: Partial<
      Pick<UserEntity, 'newProductDate' | 'adAgreeDate' | 'recommendDate'>
    > = {};

    if (body.newProduct !== undefined) {
      values.newProductDate = body.newProduct ? now : null;
    }

    if (body.ad !== undefined) {
      values.adAgreeDate = body.ad ? now : null;
    }

    if (body.recommend !== undefined) {
      values.recommendDate = body.recommend ? now : null;
    }

    await this.adminMemberRepositoryService.updateAgreement(userId, values);
  }

  async getOrderList(
    userId: number,
    query: GetAdminMemberOrderListRequest,
  ): Promise<[GetAdminMemberOrderListResponse[], number]> {
    await this.getMemberOrThrow(userId);

    const [orders, total] =
      await this.adminMemberRepositoryService.getMemberOrderList(
        userId,
        query.page ?? 1,
        query.count ?? 10,
        query.status,
        query.sort,
      );

    return [
      orders.map((order) => GetAdminMemberOrderListResponse.from(order)),
      total,
    ];
  }

  /**
   * 장바구니는 페이징하지 않는다. 운영자는 통째로 본다.
   * 상품명·옵션 텍스트는 multilingual_text 에 있어 한 번에 모아 온다.
   */
  async getCart(userId: number): Promise<GetAdminMemberCartResponse[]> {
    await this.getMemberOrThrow(userId);

    const cartItems =
      await this.cartRepositoryService.findDetailListByUserId(userId);

    if (cartItems.length === 0) {
      return [];
    }

    const [productNames, optionTexts] = await Promise.all([
      this.loadNames(
        EntityType.PRODUCT,
        cartItems.map(
          (item) => item.productVariant?.productItem?.product?.id ?? null,
        ),
      ),
      this.loadOptionTexts(cartItems),
    ]);

    return cartItems.map((cartItem) =>
      GetAdminMemberCartResponse.from(
        cartItem,
        productNames.getName(cartItem.productVariant?.productItem?.product?.id),
        optionTexts.buildOptionText(cartItem.productVariant),
      ),
    );
  }

  async getLikeList(
    userId: number,
    query: GetAdminMemberLikeListRequest,
  ): Promise<[GetAdminMemberLikeResponse[], number]> {
    await this.getMemberOrThrow(userId);

    const [rows, total] =
      await this.adminMemberRepositoryService.getMemberLikeList(
        userId,
        query.page ?? 1,
        query.count ?? 10,
        query.type,
        query.sort,
      );

    return [await this.decorateLikeRows(rows), total];
  }

  async getRecentList(
    userId: number,
    query: ListSimpleFilterDto,
  ): Promise<[GetAdminMemberRecentResponse[], number]> {
    await this.getMemberOrThrow(userId);

    const [recents, total] = await this.userRecentRepositoryService.getList(
      userId,
      query.page ?? 1,
      query.count ?? 10,
    );
    const names = await this.loadNames(
      EntityType.PRODUCT,
      recents.map((recent) => recent.productItem?.product?.id ?? null),
    );

    return [
      recents.map((recent) =>
        GetAdminMemberRecentResponse.from(
          recent,
          names.getName(recent.productItem?.product?.id),
        ),
      ),
      total,
    ];
  }

  /** 탈퇴 회원도 조회된다. 존재하지 않는 ID 만 404 다. */
  private async getMemberOrThrow(userId: number): Promise<UserEntity> {
    const user =
      await this.adminMemberRepositoryService.findMemberDetail(userId);

    if (!user) {
      throw new ServiceError(
        `No exist member ID: ${userId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return user;
  }

  /**
   * UNION 으로 뽑은 좋아요 행에 이름·이미지를 채운다.
   * 상품은 product_item -> product 를 거쳐야 이름이 나오고, 브랜드는 바로 나온다.
   */
  private async decorateLikeRows(
    rows: MemberLikeRowDto[],
  ): Promise<GetAdminMemberLikeResponse[]> {
    const productItemIds = rows
      .filter((row) => row.type === AdminMemberLikeType.PRODUCT)
      .map((row) => row.targetId);
    const brandIds = rows
      .filter((row) => row.type === AdminMemberLikeType.BRAND)
      .map((row) => row.targetId);

    const productItems =
      await this.adminMemberRepositoryService.findProductItemsByIds(
        productItemIds,
      );
    const [productNames, brandNames] = await Promise.all([
      this.loadNames(
        EntityType.PRODUCT,
        productItems.map((item) => item.productId),
      ),
      this.loadNames(EntityType.BRAND, brandIds),
    ]);

    const itemMap = new Map(productItems.map((item) => [item.id, item]));

    return rows.map((row) => {
      if (row.type === AdminMemberLikeType.BRAND) {
        return GetAdminMemberLikeResponse.from(
          row,
          brandNames.getName(row.targetId),
          null,
        );
      }

      const item = itemMap.get(row.targetId);

      return GetAdminMemberLikeResponse.from(
        row,
        productNames.getName(item?.productId),
        item?.getMainImage() || null,
      );
    });
  }

  /**
   * 옵션 텍스트는 어드민 화면 기준 언어(한국어)로 고정한다. 여러 언어를
   * 한꺼번에 받으면 "IVORY / M" 자리에 어떤 언어가 올지 정해지지 않는다.
   */
  private async loadOptionTexts(
    cartItems: CartItemEntity[],
  ): Promise<OptionTextCollectionDto> {
    const optionValueIds = this.uniqueIds(
      cartItems.flatMap((item) =>
        (item.productVariant?.variantOptions ?? []).map(
          (variantOption) => variantOption.optionValueId,
        ),
      ),
    );

    const texts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        optionValueIds,
        LanguageCode.KOREAN,
      );

    return OptionTextCollectionDto.from(texts);
  }

  private async loadNames(
    entityType: EntityType,
    ids: Array<number | null>,
  ): Promise<MultilingualNameCollectionDto> {
    const texts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        entityType,
        this.uniqueIds(ids),
      );

    return MultilingualNameCollectionDto.from(texts);
  }

  private uniqueIds(ids: Array<number | null | undefined>): number[] {
    return Array.from(
      new Set(
        ids.filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    );
  }
}
