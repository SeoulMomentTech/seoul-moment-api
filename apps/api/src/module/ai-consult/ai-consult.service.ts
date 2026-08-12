import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import {
  GeminiErrorKind,
  GeminiStructuredResultDto,
} from '@app/external/gemini/gemini.dto';
import { GeminiService } from '@app/external/gemini/gemini.service';
import {
  AiConsultLogMetaObject,
  maskPii,
} from '@app/repository/dto/ai-consult.dto';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import {
  AiConsultAnswerSource,
  AiConsultAnswerType,
  AiConsultIntent,
  AiConsultScope,
} from '@app/repository/enum/ai-consult.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import {
  DEFAULT_LANGUAGE,
  LanguageCode,
} from '@app/repository/enum/language.enum';
import { AiConsultLogRepositoryService } from '@app/repository/service/ai-consult-log.repository.service';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import {
  AiConsultAnswerDto,
  AiConsultBrandResponse,
  AiConsultCannedAnswerType,
  AiConsultCategoryCatalogDto,
  AiConsultCategoryLevel,
  AiConsultCategoryResolveDto,
  AiConsultNameMatchDto,
  AiConsultCategoryResponse,
  AiConsultCategorySource,
  AiConsultClassificationDto,
  AiConsultColorCatalogDto,
  AiConsultProductFilterDto,
  AiConsultProductResponse,
  AiConsultResolvedSlotDto,
  AiConsultLimitDto,
  AiConsultRequestContextDto,
  AiConsultUsageTotalDto,
  AI_CONSULT_FILTER_NAME_MAX,
  ANSWER_CACHE_MIN_LENGTH,
  ANSWER_CACHE_TTL_SECONDS,
  buildAnswerCacheKey,
  buildCategoryCatalogFingerprint,
  buildCategoryResolveCacheKey,
  buildDailyBudgetKey,
  CATEGORY_RESOLVE_CACHE_TTL_SECONDS,
  CATEGORY_RESOLVE_MAX_CANDIDATES,
  CATEGORY_RESOLVE_MAX_OUTPUT_TOKENS,
  CONFIDENCE_ANSWER_THRESHOLD,
  CONFIDENCE_CONFIRM_THRESHOLD,
  DAILY_BUDGET_TTL_SECONDS,
  DAILY_LLM_CALL_LIMIT,
  MAX_SUGGESTION_COUNT,
  PostAiConsultAskRequest,
  PostAiConsultAskResponse,
  RATE_LIMIT_DISABLED_ENVS,
  RATE_LIMIT_IP_WINDOW_SECONDS,
  RATE_LIMIT_PER_IP,
  RATE_LIMIT_PER_USER,
  RATE_LIMIT_USER_WINDOW_SECONDS,
} from './ai-consult.dto';
import {
  AI_CONSULT_BRAND_LIST_MESSAGE,
  AI_CONSULT_CATEGORY_EMPTY_MESSAGE,
  AI_CONSULT_CATEGORY_LIST_MESSAGE,
  AI_CONSULT_COLOR_LIST_MESSAGE,
  AI_CONSULT_CONFIRM_MESSAGE,
  AI_CONSULT_DEFAULT_SUGGESTION_CODES,
  AI_CONSULT_FALLBACK_MESSAGE,
  AI_CONSULT_FILTER_NAME_OVERFLOW,
  AI_CONSULT_NOT_FOUND_MESSAGE,
  AI_CONSULT_OFF_TOPIC_MESSAGE,
  AI_CONSULT_PRODUCT_CATEGORY_LIST_MESSAGE,
  AI_CONSULT_PRODUCT_EMPTY_MESSAGE,
  AI_CONSULT_PRODUCT_FOUND_MESSAGE,
  AI_CONSULT_PRODUCT_LIST_MESSAGE,
  AI_CONSULT_PRODUCT_PICK_MESSAGE,
  AI_CONSULT_RATE_LIMITED_MESSAGE,
  AI_CONSULT_SMALL_TALK_MESSAGE,
  AI_CONSULT_UNAVAILABLE_MESSAGE,
  AiConsultFaqCode,
  AiConsultFaqItem,
  findFaqItem,
  PREFACES,
} from './ai-consult.faq';
import {
  buildCategoryResolveSchema,
  buildCategoryResolveSystemInstruction,
  buildCategoryResolveUserContent,
  buildPromptFingerprint,
  buildResponseSchema,
  buildSystemInstruction,
  buildUserContent,
  sanitizeMessage,
} from './ai-consult.prompt';
import { MultilingualFieldDto } from '../dto/multilingual.dto';
import { GetProductResponse } from '../product/product.dto';
import { ProductService } from '../product/product.service';

const CANNED_MESSAGE: Record<
  AiConsultCannedAnswerType,
  Record<LanguageCode, string>
> = {
  [AiConsultAnswerType.FALLBACK]: AI_CONSULT_FALLBACK_MESSAGE,
  [AiConsultAnswerType.OFF_TOPIC]: AI_CONSULT_OFF_TOPIC_MESSAGE,
  [AiConsultAnswerType.RATE_LIMITED]: AI_CONSULT_RATE_LIMITED_MESSAGE,
  [AiConsultAnswerType.UNAVAILABLE]: AI_CONSULT_UNAVAILABLE_MESSAGE,
};

@Injectable()
export class AiConsultService {
  /**
   * 정적 프리픽스는 부팅 시 1회만 만든다.
   * 요청마다 재생성하면 Gemini 의 implicit context caching 이 걸리지 않고,
   * 0.5 vCPU 환경에서 문자열 조립 비용도 그대로 지연이 된다.
   */
  private readonly systemInstruction = buildSystemInstruction();
  private readonly responseSchema = buildResponseSchema();
  /**
   * 프롬프트가 바뀌면 캐시 키 공간이 통째로 갈린다.
   * 규칙을 고쳤는데 옛 판정이 24시간 살아남아 "프롬프트가 안 먹는다"고
   * 오진하는 일을 막는다.
   */
  private readonly promptFingerprint = buildPromptFingerprint(
    this.systemInstruction,
    this.responseSchema,
  );

  /**
   * 카테고리 2차 해석용. 1차와 같은 이유로 부팅 시 1회만 만든다.
   * 후보 목록은 여기 들어가지 않는다 — 소분류는 운영 중에 바뀌므로 매 요청 DB 에서
   * 읽어 userContent 앞에 붙인다.
   */
  private readonly categoryResolveInstruction =
    buildCategoryResolveSystemInstruction();
  private readonly categoryResolveSchema = buildCategoryResolveSchema();

  /** local/dev 는 개인 레이트리밋을 끈다. 전역 일일 예산은 환경과 무관하게 적용된다. */
  private readonly rateLimitEnabled = !RATE_LIMIT_DISABLED_ENVS.includes(
    Configuration.getConfig().NODE_ENV,
  );

  constructor(
    private readonly geminiService: GeminiService,
    private readonly cacheService: CacheService,
    private readonly aiConsultLogRepositoryService: AiConsultLogRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly optionRepositoryService: OptionRepositoryService,
    private readonly productService: ProductService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 어떤 경로로도 예외를 던지지 않고 항상 200 을 돌려준다.
   * 챗 위젯에서 5xx 는 에러 토스트 + 클라이언트 재시도 루프(비용 폭증)로 이어진다.
   * 저하 상태는 응답 body 의 answerType 으로 표현한다.
   */
  async postAsk(
    body: PostAiConsultAskRequest,
    acceptLanguage: LanguageCode,
    userId: number | undefined,
    request: Request,
  ): Promise<PostAiConsultAskResponse> {
    const context = AiConsultRequestContextDto.from(
      this.resolveLanguage(acceptLanguage),
      sanitizeMessage(body.message),
      userId,
    );

    const limit = await this.checkRateLimit(
      userId,
      this.resolveClientIp(request),
    );

    if (!limit.allowed && limit.blockedAnswerType) {
      return this.respondCanned(context, limit.blockedAnswerType);
    }

    const cached = await this.findCachedClassification(context);

    if (cached) {
      return this.respondClassified(
        context,
        cached,
        AiConsultAnswerSource.ANSWER_CACHE,
        null,
      );
    }

    return this.classifyAndRespond(context);
  }

  private async classifyAndRespond(
    context: AiConsultRequestContextDto,
  ): Promise<PostAiConsultAskResponse> {
    if (!(await this.consumeDailyBudget())) {
      return this.respondCanned(context, AiConsultAnswerType.UNAVAILABLE);
    }

    const result = await this.geminiService.generateStructured<unknown>({
      systemInstruction: this.systemInstruction,
      userContent: buildUserContent(context.question),
      responseSchema: this.responseSchema,
    });

    const classification = result.ok
      ? AiConsultClassificationDto.fromRaw(result.parsed)
      : null;

    if (!classification) {
      return this.respondCanned(
        context,
        this.resolveFailureAnswerType(result),
        result,
      );
    }

    await this.cacheClassification(context, classification);

    return this.respondClassified(
      context,
      classification,
      AiConsultAnswerSource.LLM,
      result,
    );
  }

  /**
   * LLM 이 응답 자체를 못 준 것(장애·예산)과 응답이 쓸모없던 것(파싱 실패)은 다르다.
   * 전자는 UNAVAILABLE 로 알리고, 후자는 FALLBACK 으로 자연스럽게 되묻는다.
   */
  private resolveFailureAnswerType(
    result: GeminiStructuredResultDto<unknown>,
  ): AiConsultCannedAnswerType {
    return result.errorKind === GeminiErrorKind.MALFORMED_OUTPUT ||
      result.errorKind === GeminiErrorKind.SAFETY_BLOCKED
      ? AiConsultAnswerType.FALLBACK
      : AiConsultAnswerType.UNAVAILABLE;
  }

  private async respondClassified(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    answerSource: AiConsultAnswerSource,
    result: GeminiStructuredResultDto<unknown> | null,
  ): Promise<PostAiConsultAskResponse> {
    const answer = await this.buildAnswer(context, classification);

    this.writeLog(context, answer, classification, answerSource, result);

    return PostAiConsultAskResponse.from(answer);
  }

  private respondCanned(
    context: AiConsultRequestContextDto,
    answerType: AiConsultCannedAnswerType,
    result: GeminiStructuredResultDto<unknown> | null = null,
  ): PostAiConsultAskResponse {
    const answer = AiConsultAnswerDto.from(
      CANNED_MESSAGE[answerType][context.language],
      answerType,
      null,
      null,
      this.buildDefaultSuggestions(context.language),
    );

    this.writeLog(context, answer, null, AiConsultAnswerSource.CANNED, result);

    return PostAiConsultAskResponse.from(answer);
  }

  /**
   * 문장이 만들어지는 유일한 지점.
   * FAQ 문구는 서버 상수에서, 브랜드 이름은 DB 에서 온다. 어느 쪽도 모델이 생성하지 않는다.
   */
  private async buildAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    if (classification.scope !== AiConsultScope.IN_SCOPE) {
      // 인젝션 시도에도 OFF_TOPIC 과 똑같이 응답해 탐지 여부를 노출하지 않는다.
      return AiConsultAnswerDto.from(
        AI_CONSULT_OFF_TOPIC_MESSAGE[context.language],
        AiConsultAnswerType.OFF_TOPIC,
        null,
        classification.confidence,
        this.buildDefaultSuggestions(context.language),
      );
    }

    // scope 를 통과한 뒤에만 DB 를 본다. 범위 외 질문으로 쿼리가 돌면 안 된다.
    return (
      (await this.buildIntentAnswer(context, classification)) ??
      this.buildFaqMatchedAnswer(context, classification)
    );
  }

  /**
   * 정적 FAQ 가 아니라 DB 실데이터·상수로 답하는 intent 들.
   * FAQ 매칭으로 내려보내야 하면 null 을 돌려준다.
   */
  private async buildIntentAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto | null> {
    switch (classification.intent) {
      // 인사·응원은 DB 를 볼 것도 없다. FAQ 로 내려보내면 "이해하지 못했어요"가 나간다.
      case AiConsultIntent.SMALL_TALK:
        return AiConsultAnswerDto.from(
          AI_CONSULT_SMALL_TALK_MESSAGE[context.language],
          AiConsultAnswerType.SMALL_TALK,
          null,
          classification.confidence,
          this.buildDefaultSuggestions(context.language),
        );
      case AiConsultIntent.BRAND_LIST:
        return this.buildBrandListAnswer(context, classification);
      case AiConsultIntent.CATEGORY_LIST:
        return this.buildCategoryAnswer(context, classification);
      case AiConsultIntent.COLOR_LIST:
        return this.buildColorListAnswer(context, classification);
      case AiConsultIntent.PRODUCT_SEARCH:
        return this.buildProductSearchAnswer(context, classification);
      default:
        return null;
    }
  }

  /** 정적 FAQ 카탈로그에서 답을 고르는 기본 경로. */
  private buildFaqMatchedAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): AiConsultAnswerDto {
    const item = findFaqItem(classification.faqCode);

    if (!item || classification.confidence < CONFIDENCE_CONFIRM_THRESHOLD) {
      return this.buildFallback(context, classification.confidence);
    }

    return classification.confidence >= CONFIDENCE_ANSWER_THRESHOLD
      ? this.buildFaqAnswer(context, classification, item)
      : this.buildConfirmAnswer(context, classification, item);
  }

  /**
   * 입점 브랜드 목록.
   * 모델은 "브랜드 목록을 원한다"만 판정했고, 이름·이미지는 전부 여기서 DB 로 재조회한다.
   * 조회 실패나 0건이면 FALLBACK 으로 degrade 한다 — 상담이 5xx 로 죽으면 안 된다.
   */
  private async buildBrandListAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const brands = await this.findBrands(language);

    if (brands.length === 0) {
      return AiConsultAnswerDto.from(
        AI_CONSULT_FALLBACK_MESSAGE[language],
        AiConsultAnswerType.FALLBACK,
        null,
        classification.confidence,
        this.buildDefaultSuggestions(language),
      );
    }

    return AiConsultAnswerDto.from(
      AI_CONSULT_BRAND_LIST_MESSAGE[language].replace(
        '{count}',
        String(brands.length),
      ),
      AiConsultAnswerType.BRAND_LIST,
      null,
      classification.confidence,
      // 브랜드 목록 자체가 다음 행동을 제시하므로 추천 칩과 겹친다.
      [],
    ).withBrands(brands);
  }

  /**
   * 취급 색상 목록.
   *
   * 브랜드 목록과 같은 모양이다 — 모델은 "색상 목록을 원한다"만 판정했고
   * 이름·색상 코드는 전부 DB 에서 재조회한다.
   */
  private async buildColorListAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const catalog = await this.findColorCatalog(language);

    if (catalog.getCount() === 0) {
      return this.buildFallback(context);
    }

    return AiConsultAnswerDto.from(
      AI_CONSULT_COLOR_LIST_MESSAGE[language].replace(
        '{count}',
        String(catalog.getCount()),
      ),
      AiConsultAnswerType.COLOR_LIST,
      null,
      classification.confidence,
      // 색상 칩 자체가 다음 행동을 제시하므로 추천 칩과 겹친다.
      [],
    ).withColors(catalog.getItems());
  }

  /**
   * 카테고리 응답.
   *
   * intent 는 하나(CATEGORY_LIST)뿐이고, 무엇을 보여줄지는 `categoryQuery` 가
   * 어디에 붙는지로 **서버가** 가른다. 모델에 맡기면 오분류가 생기는 판단인데
   * 서버는 100% 정확하게 할 수 있다.
   *
   * - 지목 없음   → 대분류 목록
   * - 대분류 지목 → 그 아래 소분류 목록
   * - 소분류 지목 → **상품 카드** (더 쪼갤 분류가 없으니 목록이 답이 될 수 없다)
   */
  private async buildCategoryAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const catalog = await this.findCategoryCatalog(language);

    // 데이터가 없는 것과 이름을 못 붙인 것은 대응이 다르므로 로그에서 갈라 남긴다.
    if (catalog.getCount() === 0) {
      return this.buildFallback(context).withCategoryMatch(
        AiConsultNameMatchDto.emptyCatalog(),
      );
    }

    if (!classification.categoryQuery) {
      return AiConsultAnswerDto.from(
        AI_CONSULT_CATEGORY_LIST_MESSAGE[language].replace(
          '{count}',
          String(catalog.getCount()),
        ),
        AiConsultAnswerType.CATEGORY_LIST,
        null,
        classification.confidence,
        [],
      ).withCategories(catalog.getItems());
    }

    const match = catalog.findMatch(classification.categoryQuery);
    const parentId = match.getId();

    if (parentId === null) {
      return this.buildProductCategoryProductsAnswer(
        context,
        classification,
        match,
      );
    }

    const answer = await this.buildProductCategoryAnswer(
      context,
      classification,
      catalog.findItem(parentId),
    );

    return answer.withCategoryMatch(match);
  }

  /**
   * 대분류가 아니었다면 소분류일 수 있다.
   *
   * "반팔은 뭐 있어?" 의 답은 목록이 아니라 상품이다 — 소분류 아래에는 더 쪼갤
   * 분류가 없어서 보여줄 목록 자체가 없다. 대분류만 보고 NOT_FOUND 로 끝내면
   * 실제로 취급하는 것을 "취급하지 않는다"고 답하게 된다.
   */
  private async buildProductCategoryProductsAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    categoryMatch: AiConsultNameMatchDto,
  ): Promise<AiConsultAnswerDto> {
    const catalog = await this.findAllProductCategoryCatalog(context.language);
    const match = await this.matchProductCategory(
      context,
      classification.categoryQuery,
      catalog,
    );

    // 대분류에도 소분류에도 없고 모델도 못 골랐다. 고객이 쓴 말은 보통 대분류
    // 수준이라 그쪽 실패 사유를 남겨야 로그로 임계값을 조정할 수 있다.
    if (match.getId() === null) {
      return this.buildNotFound(context).withCategoryMatch(categoryMatch);
    }

    return this.buildProductListAnswer(
      context,
      AiConsultProductFilterDto.from(
        classification.categoryQuery,
        '',
        this.toResolvedCategory(
          match,
          catalog,
          AiConsultCategoryLevel.PRODUCT_CATEGORY,
          context.language,
        ),
        null,
        '',
      ),
      classification.confidence,
    );
  }

  /**
   * "그런 건 아직 없어요" 한 문장으로 끝낸다.
   *
   * 고객이 쓴 말을 되풀이하지 않는다 — categoryQuery 는 모델 출력이라 그대로
   * 넣으면 인젝션 문구가 고객 화면에 찍힐 수 있다.
   * 취급 목록도 붙이지 않는다. 없다는 답에 곁들이면 동문서답이 된다.
   */
  private buildNotFound(
    context: AiConsultRequestContextDto,
  ): AiConsultAnswerDto {
    return AiConsultAnswerDto.from(
      AI_CONSULT_NOT_FOUND_MESSAGE[context.language],
      AiConsultAnswerType.NOT_FOUND,
      null,
      null,
      [],
    );
  }

  private async buildProductCategoryAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    parent: AiConsultCategoryResponse,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const catalog = await this.findProductCategoryCatalog(parent.id, language);

    // 대분류는 맞게 찾았고 아래가 비어있을 뿐이다. 이것도 이해 실패가 아니다.
    // 이름은 모델 출력이 아니라 DB 에서 읽은 값이라 문장에 넣어도 안전하다.
    if (catalog.getCount() === 0) {
      return AiConsultAnswerDto.from(
        AI_CONSULT_CATEGORY_EMPTY_MESSAGE[language].replace(
          '{name}',
          parent.name,
        ),
        AiConsultAnswerType.NOT_FOUND,
        null,
        classification.confidence,
        [],
      );
    }

    return AiConsultAnswerDto.from(
      AI_CONSULT_PRODUCT_CATEGORY_LIST_MESSAGE[language]
        // 모델이 뱉은 categoryQuery 가 아니라 DB 에서 읽은 이름을 넣는다.
        .replace('{name}', parent.name)
        .replace('{count}', String(catalog.getCount())),
      AiConsultAnswerType.PRODUCT_CATEGORY_LIST,
      null,
      classification.confidence,
      [],
    ).withCategories(catalog.getItems(), parent);
  }

  /**
   * 상품 검색.
   *
   * 모델이 지목한 조건 중 **DB 에 붙은 것만** 필터로 쓴다. 못 붙인 조건을
   * 조용히 무시하면 "검정 옷"에 아무 옷이나 보여주게 되므로, 실제로 적용된
   * 조건을 appliedFilter 로 함께 내보내 결과를 좁게 오해하지 않도록 한다.
   */
  private async buildProductSearchAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    const slot = await this.resolveProductFilter(context, classification);

    // 조건을 말했는데 하나도 못 붙였으면 전체 목록을 보여주는 대신 없다고 답한다.
    if (slot.isRequestedButUnresolved()) {
      return this.buildNotFound(context).withProductSearch(
        [],
        slot.applied,
        0,
        slot.categoryMatch,
        slot.colorMatch,
      );
    }

    return this.buildProductListAnswer(
      context,
      slot,
      classification.confidence,
    );
  }

  /**
   * 조건이 정해진 뒤의 조회·렌더링.
   * 상품 검색과 "소분류를 지목한 카테고리 질문"이 같은 답을 내야 하므로 공유한다.
   */
  private async buildProductListAnswer(
    context: AiConsultRequestContextDto,
    slot: AiConsultProductFilterDto,
    confidence: number | null,
  ): Promise<AiConsultAnswerDto> {
    const [products, total] = await this.findProducts(context, slot);

    if (products.length === 0) {
      return this.buildProductEmpty(context, slot);
    }

    return AiConsultAnswerDto.from(
      this.buildProductListMessage(context, slot, total),
      AiConsultAnswerType.PRODUCT_LIST,
      null,
      confidence,
      // 상품 카드 자체가 다음 행동을 제시하므로 추천 칩과 겹친다.
      [],
    ).withProductSearch(
      products,
      slot.applied,
      total,
      slot.categoryMatch,
      slot.colorMatch,
    );
  }

  /** 조건은 붙었는데 재고가 없는 경우. 이해 실패가 아니므로 NOT_FOUND 다. */
  private buildProductEmpty(
    context: AiConsultRequestContextDto,
    slot: AiConsultProductFilterDto,
  ): AiConsultAnswerDto {
    const { language } = context;
    // 말할 수 있는 조건이 있을 때만 조건을 되짚는다(keyword 는 모델 출력이라 제외).
    const message = slot.applied.hasDisplayable()
      ? AI_CONSULT_PRODUCT_EMPTY_MESSAGE[language].replace(
          '{filter}',
          slot.describeFilter(),
        )
      : AI_CONSULT_NOT_FOUND_MESSAGE[language];

    return AiConsultAnswerDto.from(
      message,
      AiConsultAnswerType.NOT_FOUND,
      null,
      null,
      [],
    ).withProductSearch(
      [],
      slot.applied,
      0,
      slot.categoryMatch,
      slot.colorMatch,
    );
  }

  private buildProductListMessage(
    context: AiConsultRequestContextDto,
    slot: AiConsultProductFilterDto,
    total: number,
  ): string {
    const { language } = context;

    // 조건 없이 "추천해줘" 라고만 한 경우엔 조건을 말할 수 없다.
    if (!slot.applied.hasAny()) {
      return AI_CONSULT_PRODUCT_PICK_MESSAGE[language];
    }

    // 키워드만 걸린 경우. 키워드는 모델 출력이라 문장에 넣지 않는다.
    if (!slot.applied.hasDisplayable()) {
      return AI_CONSULT_PRODUCT_FOUND_MESSAGE[language].replace(
        '{count}',
        String(total),
      );
    }

    return AI_CONSULT_PRODUCT_LIST_MESSAGE[language]
      .replace('{filter}', slot.describeFilter())
      .replace('{count}', String(total));
  }

  /**
   * 모델이 뱉은 이름을 DB id 로 바꾼다.
   * 카테고리·색상 모두 같은 매칭 규칙(완전일치→부분일치→자모 유사도)을 탄다.
   */
  private async resolveProductFilter(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultProductFilterDto> {
    const { language } = context;
    const [category, color] = await Promise.all([
      this.resolveCategorySlot(context, classification.categoryQuery),
      this.resolveColorSlot(
        classification.colorQuery,
        classification.colorHex,
        language,
      ),
    ]);

    return AiConsultProductFilterDto.from(
      classification.categoryQuery,
      classification.colorQuery,
      category,
      color,
      classification.keywordQuery,
    );
  }

  /**
   * 카테고리 이름을 대분류 → 소분류 순으로 붙인다.
   *
   * 대분류만 보면 "반팔"·"모자"·"티셔츠" 처럼 **소분류에만 있는 말**이 영원히 안 붙는다.
   * 운영 로그에서 상품 검색 실패의 큰 축이 이것이었다. 대분류를 먼저 보는 이유는
   * "화장품"처럼 양쪽에 다 있을 수 있는 이름을 넓은 쪽으로 해석해야 결과가 많기 때문이다.
   */
  private async resolveCategorySlot(
    context: AiConsultRequestContextDto,
    query: string,
  ): Promise<AiConsultResolvedSlotDto | null> {
    if (!query) return null;

    const { language } = context;
    const catalog = await this.findCategoryCatalog(language);
    const productCatalog = await this.findAllProductCategoryCatalog(language);

    if (catalog.getCount() === 0 && productCatalog.getCount() === 0) {
      return AiConsultResolvedSlotDto.unresolved(
        AiConsultNameMatchDto.emptyCatalog(),
      );
    }

    const match = catalog.findMatch(query);

    if (match.getId() !== null) {
      return this.toResolvedCategory(
        match,
        catalog,
        AiConsultCategoryLevel.CATEGORY,
        language,
      );
    }

    const productMatch = await this.matchProductCategory(
      context,
      query,
      productCatalog,
    );

    // 소분류에서도, 모델 2차 해석으로도 못 찾았으면 대분류 쪽 실패 사유를 남긴다 —
    // 고객이 말한 것은 보통 대분류 수준의 단어라 그쪽 점수가 원인 분석에 쓸모 있다.
    if (productMatch.getId() === null) {
      return AiConsultResolvedSlotDto.unresolved(match);
    }

    return this.toResolvedCategory(
      productMatch,
      productCatalog,
      AiConsultCategoryLevel.PRODUCT_CATEGORY,
      language,
    );
  }

  /**
   * 소분류 이름 붙이기. 문자열로 실패하면 **모델에게 후보 목록을 주고 다시 묻는다.**
   *
   * "옷"·"신발" 같은 상위어는 문자열 규칙으로는 영원히 안 붙는다 — "옷"과 "반팔"은
   * 자모가 하나도 겹치지 않아 유사도가 0 이고, 부분일치도 서로를 품지 못한다.
   * 임계값을 아무리 조여도 해결되지 않는 종류의 실패라서 의미를 아는 쪽에 넘긴다.
   *
   * 실패하면 문자열 매칭 결과를 그대로 돌려준다 — 실패 사유(점수·단계)가 로그에
   * 남아야 임계값을 근거 있게 조정할 수 있다.
   */
  private async matchProductCategory(
    context: AiConsultRequestContextDto,
    query: string,
    catalog: AiConsultCategoryCatalogDto,
  ): Promise<AiConsultNameMatchDto> {
    const match = catalog.findMatch(query);

    if (match.getId() !== null) return match;

    return (await this.resolveCategoryByLlm(context, query, catalog)) ?? match;
  }

  /** 붙이지 못하면 null. 호출부가 문자열 단계의 실패 사유를 유지하게 한다. */
  private async resolveCategoryByLlm(
    context: AiConsultRequestContextDto,
    query: string,
    catalog: AiConsultCategoryCatalogDto,
  ): Promise<AiConsultNameMatchDto | null> {
    const candidates = catalog.getItems();

    // 후보가 너무 많으면 2차 프롬프트가 1차 분류보다 비싸진다. 그때는 안 부른다.
    if (
      candidates.length === 0 ||
      candidates.length > CATEGORY_RESOLVE_MAX_CANDIDATES
    ) {
      return null;
    }

    const allowedIds = new Set(candidates.map((candidate) => candidate.id));
    const cacheKey = buildCategoryResolveCacheKey(
      query,
      buildCategoryCatalogFingerprint(candidates),
    );
    const cached = await this.findCachedCategoryResolve(cacheKey, allowedIds);
    const resolved =
      cached ??
      (await this.askCategoryResolve(
        context,
        query,
        candidates,
        allowedIds,
        cacheKey,
      ));

    if (!resolved?.isUsable()) return null;

    const matched = resolved
      .getIds()
      .map((id) => catalog.findItem(id))
      .filter((item): item is AiConsultCategoryResponse => item !== null);

    return matched.length === 0
      ? null
      : AiConsultNameMatchDto.llmMatched(matched);
  }

  /**
   * 2차 호출.
   *
   * 일일 예산은 1차와 **같은 카운터**로 소비한다 — 따로 세면 상한이 조용히 두 배가
   * 된다. 예산이 바닥나면 호출을 건너뛰고 기존 동작(못 붙음)으로 degrade 한다.
   */
  private async askCategoryResolve(
    context: AiConsultRequestContextDto,
    query: string,
    candidates: readonly AiConsultCategoryResponse[],
    allowedIds: ReadonlySet<number>,
    cacheKey: string,
  ): Promise<AiConsultCategoryResolveDto | null> {
    // 키가 없으면 부를 것이 없다. 예산·호출 카운터를 건드리지 않고 빠져야
    // 로컬·테스트(키 미설정이 기본)의 로그가 "부른 척" 하지 않는다.
    if (!this.geminiService.isConfigured()) return null;

    if (!(await this.consumeDailyBudget())) return null;

    const result = await this.geminiService.generateStructured<unknown>({
      systemInstruction: this.categoryResolveInstruction,
      userContent: buildCategoryResolveUserContent(query, candidates),
      responseSchema: this.categoryResolveSchema,
      maxOutputTokens: CATEGORY_RESOLVE_MAX_OUTPUT_TOKENS,
    });

    // 실패해도 토큰은 나갔을 수 있다. 누적을 먼저 해야 비용이 새지 않는다.
    context.addUsage(result.usage);

    const resolved = result.ok
      ? AiConsultCategoryResolveDto.fromRaw(result.parsed, allowedIds)
      : null;

    this.writeCategoryResolveLog(query, candidates.length, result, resolved);

    if (!resolved) return null;

    // 0건("우주선")도 캐시한다. 안 하면 같은 말이 들어올 때마다 호출이 반복된다.
    await this.cacheCategoryResolve(cacheKey, resolved);

    return resolved;
  }

  /**
   * 2차 호출 전용 로그.
   *
   * 붙는 데 성공한 질의를 모아두면 그대로 동의어 상수표의 재료가 된다 — 자주 오는
   * 말은 표로 흡수해 호출 자체를 없앨 수 있다.
   */
  private writeCategoryResolveLog(
    query: string,
    candidateCount: number,
    result: GeminiStructuredResultDto<unknown>,
    resolved: AiConsultCategoryResolveDto | null,
  ): void {
    this.logger.info('AI_CONSULT_CATEGORY_RESOLVE', {
      query,
      candidateCount,
      matchedCount: resolved?.getIds().length ?? 0,
      confidence: resolved?.getConfidence() ?? null,
      usable: resolved?.isUsable() ?? false,
      latencyMs: result.latencyMs,
      errorKind: result.errorKind,
      promptTokens: result.usage.promptTokenCount,
      outputTokens: result.usage.getOutputTokenCount(),
      estimatedCostMicroUsd: result.usage.getEstimatedCostMicroUsd(),
    });
  }

  private async findCachedCategoryResolve(
    cacheKey: string,
    allowedIds: ReadonlySet<number>,
  ): Promise<AiConsultCategoryResolveDto | null> {
    try {
      return AiConsultCategoryResolveDto.parseCache(
        await this.cacheService.find(cacheKey),
        allowedIds,
      );
    } catch (error: any) {
      this.logger.warn(
        `AI consult category resolve cache read failed: ${error.message}`,
      );

      return null;
    }
  }

  private async cacheCategoryResolve(
    cacheKey: string,
    resolved: AiConsultCategoryResolveDto,
  ): Promise<void> {
    try {
      await this.cacheService.set(
        cacheKey,
        resolved.toCacheJson(),
        CATEGORY_RESOLVE_CACHE_TTL_SECONDS,
      );
    } catch (error: any) {
      this.logger.warn(
        `AI consult category resolve cache write failed: ${error.message}`,
      );
    }
  }

  private toResolvedCategory(
    match: AiConsultNameMatchDto,
    catalog: AiConsultCategoryCatalogDto,
    level: AiConsultCategoryLevel,
    language: LanguageCode,
  ): AiConsultResolvedSlotDto {
    return AiConsultResolvedSlotDto.resolved(
      match.getId(),
      this.describeMatchedCategories(match, catalog, language),
      match,
      level,
    );
  }

  /**
   * 걸린 분류가 여럿이면 함께 적는다.
   *
   * "모자"에 러닝 모자·비니 모자가 걸렸는데 대표 하나만 써서 "러닝 모자 상품 2개"라고
   * 답하면 비니가 왜 나왔는지 설명이 안 된다. 고객이 쓴 말("모자")을 그대로 쓸 수도
   * 없다 — 모델 출력이라 문장에 넣지 않는다는 규칙이 있다. 그래서 DB 이름을 나열한다.
   */
  private describeMatchedCategories(
    match: AiConsultNameMatchDto,
    catalog: AiConsultCategoryCatalogDto,
    language: LanguageCode,
  ): string {
    const names = match
      .getIds()
      .map((id) => catalog.findItem(id)?.name)
      .filter((name): name is string => Boolean(name));
    const shown = names.slice(0, AI_CONSULT_FILTER_NAME_MAX).join(', ');
    const rest = names.length - AI_CONSULT_FILTER_NAME_MAX;

    return rest > 0
      ? AI_CONSULT_FILTER_NAME_OVERFLOW[language]
          .replace('{names}', shown)
          .replace('{rest}', String(rest))
      : shown;
  }

  /**
   * @param hex 모델이 정규화한 표준 색. 이름으로 못 붙었을 때 색공간 비교에 쓴다.
   *   모델이 안 줬으면 빈 문자열이고, 그때는 이름 매칭만으로 판정한다.
   */
  private async resolveColorSlot(
    query: string,
    hex: string,
    language: LanguageCode,
  ): Promise<AiConsultResolvedSlotDto | null> {
    if (!query) return null;

    const catalog = await this.findColorCatalog(language);

    if (catalog.getCount() === 0) {
      return AiConsultResolvedSlotDto.unresolved(
        AiConsultNameMatchDto.emptyCatalog(),
      );
    }

    const match = catalog.findMatch(query, hex || null);
    const id = match.getId();

    return id === null
      ? AiConsultResolvedSlotDto.unresolved(match)
      : AiConsultResolvedSlotDto.resolved(id, catalog.findItem(id).name, match);
  }

  /** 조회 실패는 빈 목록으로 degrade 한다 — 상담이 5xx 로 죽으면 안 된다. */
  private async findProducts(
    context: AiConsultRequestContextDto,
    slot: AiConsultProductFilterDto,
  ): Promise<[AiConsultProductResponse[], number]> {
    try {
      const [items, total] = await this.productService.getProduct(
        slot.toProductRequest(),
        context.language,
      );

      return [items.map((item) => this.toProductResponse(item)), total];
    } catch (error: any) {
      this.logger.warn(`AI consult product lookup failed: ${error.message}`);

      return [[], 0];
    }
  }

  /** 리뷰 수·평점은 아직 임시값이라 상담 답변에 싣지 않는다. */
  private toProductResponse(
    item: GetProductResponse,
  ): AiConsultProductResponse {
    return AiConsultProductResponse.from(
      item.id,
      item.productName,
      item.brandName,
      item.price,
      item.image || null,
    );
  }

  private async findColorCatalog(
    language: LanguageCode,
  ): Promise<AiConsultColorCatalogDto> {
    const empty = AiConsultColorCatalogDto.from([], [], language);

    try {
      const entityList =
        await this.optionRepositoryService.findColorOptionValues();

      if (entityList.length === 0) return empty;

      const textList =
        await this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.OPTION_VALUE,
          entityList.map((entity) => entity.id),
        );

      return AiConsultColorCatalogDto.from(
        entityList.map((entity) => ({
          id: entity.id,
          code: entity.colorCode ?? null,
        })),
        textList,
        language,
      );
    } catch (error: any) {
      this.logger.warn(`AI consult color lookup failed: ${error.message}`);

      return empty;
    }
  }

  /** 대분류에는 이미지 컬럼이 없다. */
  private async findCategoryCatalog(
    language: LanguageCode,
  ): Promise<AiConsultCategoryCatalogDto> {
    const entityList = await this.categoryRepositoryService.findCategory();

    return this.toCategoryCatalog(
      EntityType.CATEGORY,
      entityList.map((entity) => ({ id: entity.id, image: null })),
      language,
    );
  }

  /**
   * 대분류를 가리지 않은 소분류 전체.
   *
   * 상품 검색에서 "반팔"처럼 소분류 이름만 말한 경우, 어느 대분류에 속하는지
   * 모르는 상태로 이름을 붙여야 하므로 전량을 색인한다.
   */
  private async findAllProductCategoryCatalog(
    language: LanguageCode,
  ): Promise<AiConsultCategoryCatalogDto> {
    let entityList: ProductCategoryEntity[] = [];

    try {
      entityList = await this.categoryRepositoryService.findProductCategory();
    } catch (error: any) {
      // 조회 실패는 빈 카탈로그로 degrade 한다 — 상담이 5xx 로 죽으면 안 된다.
      this.logger.warn(
        `AI consult product category lookup failed: ${error.message}`,
      );
    }

    return this.toCategoryCatalog(
      EntityType.PRODUCT_CATEGORY,
      entityList.map((entity) => ({
        id: entity.id,
        image: entity.imageUrl ? entity.getImage() : null,
      })),
      language,
    );
  }

  /**
   * `getImage()` 는 imageUrl 이 null 이어도 도메인을 붙여 ".../null" 을 만든다.
   * 엔티티를 고치면 상품 API 까지 영향을 받으므로 여기서 막는다.
   */
  private async findProductCategoryCatalog(
    categoryId: number,
    language: LanguageCode,
  ): Promise<AiConsultCategoryCatalogDto> {
    const entityList =
      await this.categoryRepositoryService.findProductCategoryByCategoryId(
        categoryId,
      );

    return this.toCategoryCatalog(
      EntityType.PRODUCT_CATEGORY,
      entityList.map((entity) => ({
        id: entity.id,
        image: entity.imageUrl ? entity.getImage() : null,
      })),
      language,
    );
  }

  /** 조회 실패는 빈 카탈로그로 degrade 한다 — 상담이 5xx 로 죽으면 안 된다. */
  private async toCategoryCatalog(
    entityType: EntityType,
    sources: AiConsultCategorySource[],
    language: LanguageCode,
  ): Promise<AiConsultCategoryCatalogDto> {
    const empty = AiConsultCategoryCatalogDto.from([], [], language);

    if (sources.length === 0) return empty;

    try {
      // 언어를 지정하지 않고 전부 읽는다. 노출은 요청 언어로 하되, 이름 매칭은
      // 모든 언어로 해야 Accept-Language 와 다른 언어로 물어도 잡힌다.
      const textList =
        await this.languageRepositoryService.findMultilingualTextsByEntities(
          entityType,
          sources.map((source) => source.id),
        );

      return AiConsultCategoryCatalogDto.from(sources, textList, language);
    } catch (error: any) {
      this.logger.warn(`AI consult category lookup failed: ${error.message}`);

      return empty;
    }
  }

  /**
   * confidence 는 로그 전용이다. FAQ 매칭이 임계값에 못 미쳐 떨어진 경우 그 점수를
   * 남겨야 "몇 점에서 놓쳤는지"로 임계값을 조정할 수 있다.
   */
  private buildFallback(
    context: AiConsultRequestContextDto,
    confidence: number | null = null,
  ): AiConsultAnswerDto {
    return AiConsultAnswerDto.from(
      AI_CONSULT_FALLBACK_MESSAGE[context.language],
      AiConsultAnswerType.FALLBACK,
      null,
      confidence,
      this.buildDefaultSuggestions(context.language),
    );
  }

  private async findBrands(
    language: LanguageCode,
  ): Promise<AiConsultBrandResponse[]> {
    try {
      const entityList =
        await this.brandRepositoryService.findAllNormalBrandList();

      if (entityList.length === 0) return [];

      const textList =
        await this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.BRAND,
          entityList.map((entity) => entity.id),
          language,
        );

      return entityList
        .map((entity) => this.toBrandResponse(entity, textList))
        .filter((brand): brand is AiConsultBrandResponse => brand !== null);
    } catch (error: any) {
      this.logger.warn(`AI consult brand lookup failed: ${error.message}`);

      return [];
    }
  }

  /** 해당 언어 이름이 없는 브랜드는 목록에서 뺀다 — 빈 이름 카드가 나가면 안 된다. */
  private toBrandResponse(
    entity: BrandEntity,
    textList: MultilingualTextEntity[],
  ): AiConsultBrandResponse | null {
    const name = MultilingualFieldDto.fromByEntityList(
      textList.filter((text) => text.entityId === entity.id),
      'name',
    ).getContent();

    if (!name) return null;

    return AiConsultBrandResponse.from(
      entity.id,
      name,
      entity.getProfileImage() || null,
    );
  }

  private buildFaqAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    item: AiConsultFaqItem,
  ): AiConsultAnswerDto {
    const { language } = context;
    const preface = PREFACES[classification.prefaceId][language];

    return AiConsultAnswerDto.from(
      `${preface}${item.answer[language]}`,
      AiConsultAnswerType.FAQ_ANSWER,
      item.code,
      classification.confidence,
      // 답이 확실할 때는 되물을 게 없어 칩을 붙이지 않는다. 단 "무엇을 물어볼까요"는
      // 칩 자체가 답이라 예외다 — 안 붙이면 "아래에서 고르세요" 뒤가 비어버린다.
      item.code === AiConsultFaqCode.SUGGESTED_QUESTIONS
        ? this.buildDefaultSuggestions(language)
        : [],
    );
  }

  private buildConfirmAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    item: AiConsultFaqItem,
  ): AiConsultAnswerDto {
    const { language } = context;
    const message = AI_CONSULT_CONFIRM_MESSAGE[language].replace(
      '{title}',
      item.title[language],
    );

    return AiConsultAnswerDto.from(
      message,
      AiConsultAnswerType.CONFIRM_SUGGESTION,
      item.code,
      classification.confidence,
      this.buildSuggestions(
        [item.code as string, ...classification.alternatives],
        language,
      ),
    );
  }

  /**
   * 챗 위젯을 열었을 때 보여줄 시작 질문.
   * LLM·Redis·DB 를 전혀 타지 않는 순수 상수 조회다.
   */
  getInitialSuggestions(acceptLanguage: LanguageCode): string[] {
    return this.buildDefaultSuggestions(this.resolveLanguage(acceptLanguage));
  }

  private buildDefaultSuggestions(language: LanguageCode): string[] {
    return this.buildSuggestions(
      AI_CONSULT_DEFAULT_SUGGESTION_CODES as readonly string[],
      language,
    );
  }

  private buildSuggestions(
    codes: readonly string[],
    language: LanguageCode,
  ): string[] {
    return [...new Set(codes)]
      .map((code) => findFaqItem(code))
      .filter((item) => item !== null)
      .slice(0, MAX_SUGGESTION_COUNT)
      .map((item) => item.title[language]);
  }

  private resolveLanguage(acceptLanguage?: LanguageCode): LanguageCode {
    return Object.values(LanguageCode).includes(acceptLanguage)
      ? acceptLanguage
      : DEFAULT_LANGUAGE;
  }

  /**
   * ALB 는 받은 x-forwarded-for 에 클라이언트 IP 를 append 하므로,
   * 클라이언트가 XFF 를 위조해도 **마지막 항목**은 ALB 가 실제로 본 IP 다.
   * 첫 항목을 쓰면 위조로 리밋을 우회할 수 있고, req.ip 를 쓰면 ALB 사설 IP
   * 하나로 전체 트래픽이 뭉쳐 정상 유저가 함께 차단된다.
   */
  private resolveClientIp(request: Request): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded)
      ? forwarded[forwarded.length - 1]
      : forwarded;
    const parts = raw
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (parts?.length) return parts[parts.length - 1];

    return request.ip ?? null;
  }

  /**
   * 로그인 유저는 userId 로, 게스트는 IP 로 센다.
   * 로그인 유저에게 IP 리밋을 겹쳐 걸지 않는 이유: 사무실·학교처럼 NAT 뒤에 있는
   * 정상 유저가 서로의 요청 때문에 차단되고, 유저 리밋이 사실상 도달 불가능해진다.
   * 토큰이 있어도 유저당 상한은 여전히 걸리므로 우회 경로가 되지는 않는다.
   */
  private async checkRateLimit(
    userId: number | undefined,
    ip: string | null,
  ): Promise<AiConsultLimitDto> {
    if (!this.rateLimitEnabled) return AiConsultLimitDto.allow();

    if (userId) {
      return (await this.isOverLimit(
        `user:${userId}`,
        RATE_LIMIT_PER_USER,
        RATE_LIMIT_USER_WINDOW_SECONDS,
      ))
        ? AiConsultLimitDto.rateLimited()
        : AiConsultLimitDto.allow();
    }

    if (!ip || RATE_LIMIT_PER_IP <= 0) return AiConsultLimitDto.allow();

    return (await this.isOverLimit(
      `ip:${ip}`,
      RATE_LIMIT_PER_IP,
      RATE_LIMIT_IP_WINDOW_SECONDS,
    ))
      ? AiConsultLimitDto.rateLimited()
      : AiConsultLimitDto.allow();
  }

  private async isOverLimit(
    suffix: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const count = await this.cacheService.incrementWithExpire(
      `${RedisKey.AI_CONSULT_RATE}:${suffix}`,
      windowSeconds,
    );

    return count > limit;
  }

  /**
   * 상한을 실제로 "보장"하는 유일한 장치.
   * 캐시 히트는 LLM 을 부르지 않으므로 여기까지 오지 않는다.
   */
  private async consumeDailyBudget(): Promise<boolean> {
    const key = buildDailyBudgetKey();
    const count = await this.cacheService.incrementWithExpire(
      key,
      DAILY_BUDGET_TTL_SECONDS,
    );

    if (count > DAILY_LLM_CALL_LIMIT) {
      this.logger.warn('AI_CONSULT_DAILY_BUDGET_EXCEEDED', {
        key,
        count,
        limit: DAILY_LLM_CALL_LIMIT,
      });

      return false;
    }

    return true;
  }

  /** 캐시에는 문장이 아니라 판정 결과만 담아 FAQ 문구 수정이 즉시 반영되게 한다. */
  private async findCachedClassification(
    context: AiConsultRequestContextDto,
  ): Promise<AiConsultClassificationDto | null> {
    if (context.question.length < ANSWER_CACHE_MIN_LENGTH) return null;

    try {
      const cached = await this.cacheService.find(
        buildAnswerCacheKey(
          context.question,
          context.language,
          this.promptFingerprint,
        ),
      );

      return AiConsultClassificationDto.parseCache(cached);
    } catch (error: any) {
      this.logger.warn(`AI consult cache read failed: ${error.message}`);

      return null;
    }
  }

  private async cacheClassification(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<void> {
    if (context.question.length < ANSWER_CACHE_MIN_LENGTH) return;

    try {
      await this.cacheService.set(
        buildAnswerCacheKey(
          context.question,
          context.language,
          this.promptFingerprint,
        ),
        classification.toCacheJson(),
        ANSWER_CACHE_TTL_SECONDS,
      );
    } catch (error: any) {
      this.logger.warn(`AI consult cache write failed: ${error.message}`);
    }
  }

  /**
   * DB·Winston 모두 게스트 포함 전건.
   * 저장 실패가 상담 응답을 막지 않도록 트랜잭션 없이 fire-and-forget 한다.
   */
  private writeLog(
    context: AiConsultRequestContextDto,
    response: AiConsultAnswerDto,
    classification: AiConsultClassificationDto | null,
    answerSource: AiConsultAnswerSource,
    result: GeminiStructuredResultDto<unknown> | null,
  ): void {
    const maskedQuestion = maskPii(context.question);

    const usage = AiConsultUsageTotalDto.from(context, result?.usage ?? null);

    this.writeStructuredLog(
      maskedQuestion,
      context,
      response,
      classification,
      answerSource,
      result,
      usage,
    );

    // 레이트리밋에 걸린 요청만 DB 에서 뺀다. 이미 차단된 뒤에도 계속 때리면
    // 요청 수만큼 INSERT 가 늘어 DB 가 증폭 공격 대상이 된다(게스트는 상한이 없다).
    // 집계에 필요한 정보는 위 Winston 로그에 그대로 남는다.
    if (response.answerType === AiConsultAnswerType.RATE_LIMITED) return;

    this.persistLog(
      maskedQuestion,
      context,
      response,
      classification,
      answerSource,
      result,
      usage,
    );
  }

  /**
   * Winston 구조화 로그. DB 적재와 달리 레이트리밋 건까지 전건 남는다.
   * categoryQuery·categoryMatch 를 함께 남겨야 FALLBACK 한 건만 보고도
   * 어느 단계에서 무슨 점수로 떨어졌는지 알 수 있다.
   */
  private writeStructuredLog(
    maskedQuestion: string,
    context: AiConsultRequestContextDto,
    response: AiConsultAnswerDto,
    classification: AiConsultClassificationDto | null,
    answerSource: AiConsultAnswerSource,
    result: GeminiStructuredResultDto<unknown> | null,
    usage: AiConsultUsageTotalDto,
  ): void {
    this.logger.info('AI_CONSULT', {
      userId: context.userId ?? null,
      languageCode: context.language,
      scope: classification?.scope ?? null,
      faqCode: response.faqCode,
      confidence: response.confidence,
      answerType: response.answerType,
      answerSource,
      latencyMs: result?.latencyMs ?? 0,
      errorKind: result?.errorKind ?? null,
      intent: classification?.intent ?? null,
      categoryQuery: classification?.categoryQuery || null,
      // FALLBACK 이 "카테고리 질문이 아니었다"인지 "이름을 못 붙였다"인지 가른다.
      categoryMatch: response.categoryMatch?.toLogMeta() ?? null,
      colorQuery: classification?.colorQuery || null,
      // 색 매칭이 틀렸을 때 모델이 준 색이 문제인지 우리 게이트가 문제인지 가른다.
      colorHex: classification?.colorHex || null,
      colorMatch: response.colorMatch?.toLogMeta() ?? null,
      keywordQuery: classification?.keywordQuery || null,
      productCount: response.productCount,
      // 1차 + 2차 합산이다. 합치는 규칙은 AiConsultUsageTotalDto 에 있다.
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      estimatedCostMicroUsd: usage.estimatedCostMicroUsd,
      categoryResolveCalls: usage.categoryResolveCalls,
      // 매칭 실패 질문만 남겨 FAQ 보강 근거로 쓴다(전건 원문 적재 방지).
      question:
        response.answerType === AiConsultAnswerType.FAQ_ANSWER
          ? undefined
          : maskedQuestion,
    });
  }

  private persistLog(
    maskedQuestion: string,
    context: AiConsultRequestContextDto,
    response: AiConsultAnswerDto,
    classification: AiConsultClassificationDto | null,
    answerSource: AiConsultAnswerSource,
    result: GeminiStructuredResultDto<unknown> | null,
    usage: AiConsultUsageTotalDto,
  ): void {
    void this.aiConsultLogRepositoryService
      .save({
        userId: context.userId ?? null,
        languageCode: context.language,
        question: maskedQuestion,
        scope: classification?.scope ?? null,
        answerType: response.answerType,
        answerSource,
        matchedFaqCode: response.faqCode,
        confidence: response.confidence,
        // 2차 해석만 돈 경우(답변 캐시 히트)에도 호출한 모델은 남겨야 한다.
        model:
          result || usage.categoryResolveCalls > 0
            ? Configuration.getConfig().GEMINI_MODEL
            : null,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        estimatedCostMicroUsd: usage.estimatedCostMicroUsd,
        latencyMs: result?.latencyMs ?? 0,
        finishReason: result?.finishReason ?? null,
        errorKind: result?.errorKind ?? null,
        traceId: this.logger.getTraceId(),
        meta: this.buildLogMeta(response, classification, answerSource, usage),
      })
      .catch((error) =>
        this.logger.warn(`Failed to persist AI consult log: ${error.message}`),
      );
  }

  /** 컬럼으로 두기엔 잦게 바뀌는 판정 부산물. 집계가 아니라 사후 분석에 쓴다. */
  private buildLogMeta(
    response: AiConsultAnswerDto,
    classification: AiConsultClassificationDto | null,
    answerSource: AiConsultAnswerSource,
    usage: AiConsultUsageTotalDto,
  ): AiConsultLogMetaObject {
    return {
      cacheHit: answerSource === AiConsultAnswerSource.ANSWER_CACHE,
      alternatives: classification?.alternatives,
      reason: classification?.reason,
      // faqCode + languageCode + prefaceId 면 고객이 본 answer 를 그대로 재현할 수 있다.
      prefaceId: classification?.prefaceId,
      intent: classification?.intent,
      categoryQuery: classification?.categoryQuery || undefined,
      categoryMatch: response.categoryMatch?.toLogMeta(),
      colorQuery: classification?.colorQuery || undefined,
      colorHex: classification?.colorHex || undefined,
      colorMatch: response.colorMatch?.toLogMeta(),
      keywordQuery: classification?.keywordQuery || undefined,
      productCount: response.productCount ?? undefined,
      // 0 이면 문자열로 끝났거나 캐시가 맞았다는 뜻이라 남길 게 없다.
      categoryResolveCalls: usage.categoryResolveCalls || undefined,
    };
  }
}
