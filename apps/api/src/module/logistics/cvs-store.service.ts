import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { CvsChain } from '@app/repository/enum/order.enum';
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

import { CvsMapState, GetCvsStoreResponse } from './logistics.dto';
import {
  renderAutoSubmitPage,
  renderMessagePage,
} from '../payment/payment.html';

/** 전자지도를 열고 고르는 데 쓰는 시간 + 주문서를 마저 채우는 시간 */
const CVS_TTL_SECONDS = 60 * 60;
const MAP_KEY = 'cvs_map';
const STORE_KEY = 'cvs_store';

export interface CvsMapReply {
  redirectUrl: string | null;
  html: string | null;
}

/**
 * 편의점 픽업 매장 선택 (ECPay 물류 전자지도, developers.ecpay.com.tw/8795).
 *
 * 전자지도는 브라우저 form POST 로 열고, 고른 매장은 브라우저가 ServerReplyURL 로 POST 해 온다.
 * 요청·응답 모두 CheckMacValue 가 없어서 서명으로 검증할 수 없다 — 우리가 발급한 nonce(ExtraData)가
 * 돌아왔는지로만 짝을 맞춘다. 사용자가 응답을 위조하면 배송지와 외섬 판정이 틀어질 수 있어서
 * 주문 쪽에서 매장 주소로 외섬을 한 번 더 판정하고, 출고 때 운송장 생성에서 매장이 다시 검증된다.
 * 결제창처럼 GET URL 하나로 열 수 있게 서버가 form 을 그린다 (LINE 인앱 브라우저 대응).
 */
@Injectable()
export class CvsStoreService {
  private readonly logger = new Logger(CvsStoreService.name);

  constructor(private readonly cacheService: CacheService) {}

  async renderMapPage(
    chain: CvsChain,
    returnUrl: unknown,
    userAgent: string | undefined,
  ): Promise<string> {
    if (!Object.values(CvsChain).includes(chain)) {
      throw new ServiceError(
        `Unsupported CVS chain: ${chain}`,
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    const config = Configuration.getConfig();
    const nonce = randomBytes(10).toString('hex');
    const state: CvsMapState = {
      chain,
      logisticsSubType: toSubType(chain),
      returnUrl: this.safeReturnUrl(returnUrl),
    };

    await this.cacheService.set(
      `${MAP_KEY}:${nonce}`,
      JSON.stringify(state),
      CVS_TTL_SECONDS,
    );

    return renderAutoSubmitPage({
      action: `${config.ECPAY_LOGISTICS_URL}/Express/map`,
      fields: {
        MerchantID: config.ECPAY_LOGISTICS_MERCHANT_ID,
        LogisticsType: 'CVS',
        LogisticsSubType: state.logisticsSubType,
        IsCollection: 'N',
        ServerReplyURL: `${config.PAYMENT_CALLBACK_BASE_URL}/logistics/cvs/map/reply`,
        ExtraData: nonce,
        Device: isMobile(userAgent) ? '1' : '0',
      },
    });
  }

  /** ECPay 전자지도가 브라우저로 돌려보낸 매장. 보관하고 주문서로 돌려보낸다 */
  /**
   * nonce 는 한 번만 쓴다 — 같은 nonce 로 매장을 계속 덮어쓰지 못하게.
   * 서명이 없는 응답이라 필드는 order_shipping 컬럼 길이에 맞춰 형식을 확인하고,
   * 체인(LogisticsSubType)은 응답 값이 아니라 우리가 기억한 값을 쓴다.
   */
  async handleMapReply(body: unknown): Promise<CvsMapReply> {
    const fields = toStoreFields(body);
    const nonce = fields?.ExtraData ?? '';
    const mapKey = `${MAP_KEY}:${nonce}`;
    // 동시에 두 번 와도 한쪽만 통과하게 꺼내면서 지운다
    const raw =
      fields && /^[0-9a-f]{20}$/.test(nonce)
        ? await this.cacheService.take(mapKey).catch(() => null)
        : null;

    if (!fields || !raw) {
      this.logger.warn(`CVS map reply rejected (nonce or fields): ${nonce}`);

      return {
        redirectUrl: null,
        html: renderMessagePage('門市選擇已逾時', '請回到訂單頁重新選擇門市。'),
      };
    }

    const state = JSON.parse(raw) as CvsMapState;
    const store = GetCvsStoreResponse.of({
      storeToken: nonce,
      chain: state.chain,
      logisticsSubType: state.logisticsSubType,
      storeId: fields.CVSStoreID,
      storeName: fields.CVSStoreName,
      storeAddress: fields.CVSAddress,
      storeTelephone: fields.CVSTelephone || null,
      isOutsideIsland: fields.CVSOutSide === '1',
    });

    await this.cacheService.set(
      `${STORE_KEY}:${nonce}`,
      JSON.stringify(store),
      CVS_TTL_SECONDS,
    );

    if (state.returnUrl) {
      const separator = state.returnUrl.includes('?') ? '&' : '?';

      return {
        redirectUrl: `${state.returnUrl}${separator}cvsStoreToken=${nonce}`,
        html: null,
      };
    }

    return { redirectUrl: null, html: renderStorePage(store) };
  }

  async getStore(token: string): Promise<GetCvsStoreResponse> {
    const store = await this.findStore(token);

    if (!store) {
      throw new ServiceError(
        'No exist CVS store for the token (expired after 1 hour)',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return store;
  }

  async findStore(token: string): Promise<GetCvsStoreResponse | null> {
    if (!token || !/^[0-9a-f]{20}$/.test(token)) {
      return null;
    }

    const raw = await this.cacheService
      .find(`${STORE_KEY}:${token}`)
      .catch(() => null);

    return raw ? GetCvsStoreResponse.of(JSON.parse(raw)) : null;
  }

  /**
   * 열린 리다이렉트를 막는다. 프론트 주소로 시작하는 URL 만 받는다.
   * ALLOW_LOCALHOST_RETURN_URL 이면 로컬 프론트(localhost·127.0.0.1, 포트 무관)도 받는다.
   */
  private safeReturnUrl(returnUrl: unknown): string | null {
    const config = Configuration.getConfig();

    // 쿼리가 두 번 오면 배열이 된다 — 문자열 하나일 때만 받는다
    if (typeof returnUrl !== 'string' || !returnUrl) {
      return null;
    }

    if (config.ALLOW_LOCALHOST_RETURN_URL && isLocalhostUrl(returnUrl)) {
      return returnUrl;
    }

    if (!config.STOREFRONT_BASE_URL) {
      return null;
    }

    const base = config.STOREFRONT_BASE_URL.replace(/\/+$/, '');

    return returnUrl === base || returnUrl.startsWith(`${base}/`)
      ? returnUrl
      : null;
  }
}

/** C2C 면 UNIMARTC2C 처럼 접미사가 붙는다. 상점 하나는 B2C·C2C 중 한쪽만 쓸 수 있다 */
interface StoreFields {
  ExtraData: string;
  CVSStoreID: string;
  CVSStoreName: string;
  CVSAddress: string;
  CVSTelephone: string;
  CVSOutSide: string;
}

/** 전자지도 응답 필드. 형식이 틀리거나 길이가 컬럼을 넘으면 null (서명이 없어 여기서 막는다) */
function toStoreFields(body: unknown): StoreFields | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const source = body as Record<string, unknown>;
  const text = (key: string) => {
    const value = source[key];

    return typeof value === 'string' ? value.trim() : '';
  };

  const fields: StoreFields = {
    ExtraData: text('ExtraData'),
    CVSStoreID: text('CVSStoreID'),
    CVSStoreName: text('CVSStoreName'),
    CVSAddress: text('CVSAddress'),
    CVSTelephone: text('CVSTelephone'),
    CVSOutSide: text('CVSOutSide'),
  };

  const valid =
    /^[0-9A-Za-z]{1,10}$/.test(fields.CVSStoreID) &&
    fields.CVSStoreName.length > 0 &&
    fields.CVSStoreName.length <= 50 &&
    fields.CVSAddress.length > 0 &&
    fields.CVSAddress.length <= 120 &&
    fields.CVSTelephone.length <= 20 &&
    ['', '0', '1'].includes(fields.CVSOutSide);

  return valid ? fields : null;
}

export function toSubType(chain: CvsChain): string {
  const type = Configuration.getConfig().ECPAY_LOGISTICS_TYPE;

  return type === 'B2C' ? chain : `${chain}C2C`;
}

/**
 * hostname 을 URL 로 파싱해 정확히 비교한다 — 문자열 접두사로 보면
 * `http://localhost.evil.com` · `http://localhost@evil.com` 이 빠져나간다.
 */
function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function isMobile(userAgent: string | undefined): boolean {
  return /Mobile|Android|iPhone|iPad|Line\//i.test(userAgent ?? '');
}

/** 프론트 주소가 없을 때(개발 초기) 고른 매장과 토큰을 보여준다 */
function renderStorePage(store: GetCvsStoreResponse): string {
  return renderMessagePage(
    '已選擇門市',
    `${store.storeName} (${store.storeId}) ${store.storeAddress} · token=${store.storeToken}`,
  );
}
