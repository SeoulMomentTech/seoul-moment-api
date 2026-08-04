import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import {
  GeminiErrorKind,
  GeminiStructuredResultDto,
  GeminiUsageDto,
} from '@app/external/gemini/gemini.dto';
import { GeminiService } from '@app/external/gemini/gemini.service';
import { maskPii } from '@app/repository/dto/ai-consult.dto';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
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
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import {
  AiConsultAnswerDto,
  AiConsultBrandResponse,
  AiConsultCannedAnswerType,
  AiConsultCategoryCatalogDto,
  AiConsultCategoryResponse,
  AiConsultCategorySource,
  AiConsultClassificationDto,
  AiConsultLimitDto,
  AiConsultRequestContextDto,
  ANSWER_CACHE_MIN_LENGTH,
  ANSWER_CACHE_TTL_SECONDS,
  buildAnswerCacheKey,
  buildDailyBudgetKey,
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
  AI_CONSULT_CATEGORY_LIST_MESSAGE,
  AI_CONSULT_CONFIRM_MESSAGE,
  AI_CONSULT_DEFAULT_SUGGESTION_CODES,
  AI_CONSULT_FALLBACK_MESSAGE,
  AI_CONSULT_OFF_TOPIC_MESSAGE,
  AI_CONSULT_PRODUCT_CATEGORY_LIST_MESSAGE,
  AI_CONSULT_RATE_LIMITED_MESSAGE,
  AI_CONSULT_UNAVAILABLE_MESSAGE,
  AiConsultFaqItem,
  findFaqItem,
  PREFACES,
} from './ai-consult.faq';
import {
  buildResponseSchema,
  buildSystemInstruction,
  buildUserContent,
  sanitizeMessage,
} from './ai-consult.prompt';
import { MultilingualFieldDto } from '../dto/multilingual.dto';

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
    const { language } = context;

    if (classification.scope !== AiConsultScope.IN_SCOPE) {
      // 인젝션 시도에도 OFF_TOPIC 과 똑같이 응답해 탐지 여부를 노출하지 않는다.
      return AiConsultAnswerDto.from(
        AI_CONSULT_OFF_TOPIC_MESSAGE[language],
        AiConsultAnswerType.OFF_TOPIC,
        null,
        classification.confidence,
        this.buildDefaultSuggestions(language),
      );
    }

    // scope 를 통과한 뒤에만 DB 를 본다. 범위 외 질문으로 쿼리가 돌면 안 된다.
    if (classification.intent === AiConsultIntent.BRAND_LIST) {
      return this.buildBrandListAnswer(context, classification);
    }

    if (classification.intent === AiConsultIntent.CATEGORY_LIST) {
      return this.buildCategoryAnswer(context, classification);
    }

    const item = findFaqItem(classification.faqCode);

    if (!item || classification.confidence < CONFIDENCE_CONFIRM_THRESHOLD) {
      return AiConsultAnswerDto.from(
        AI_CONSULT_FALLBACK_MESSAGE[language],
        AiConsultAnswerType.FALLBACK,
        null,
        classification.confidence,
        this.buildDefaultSuggestions(language),
      );
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
   * 카테고리 응답.
   *
   * intent 는 하나(CATEGORY_LIST)뿐이고, 대분류 목록인지 소분류 목록인지는
   * `categoryQuery` 가 비었는지로 **서버가** 가른다. 모델에 맡기면 오분류가
   * 생기는 판단인데 서버는 100% 정확하게 할 수 있다.
   */
  private async buildCategoryAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const catalog = await this.findCategoryCatalog(language);

    if (catalog.getCount() === 0) return this.buildFallback(context);

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

    const parentId = catalog.findIdByQuery(classification.categoryQuery);

    // 없는 카테고리를 지목했으면 억지로 고르지 않고 되묻는다.
    if (parentId === null) return this.buildFallback(context);

    return this.buildProductCategoryAnswer(
      context,
      classification,
      catalog.findItem(parentId),
    );
  }

  private async buildProductCategoryAnswer(
    context: AiConsultRequestContextDto,
    classification: AiConsultClassificationDto,
    parent: AiConsultCategoryResponse,
  ): Promise<AiConsultAnswerDto> {
    const { language } = context;
    const catalog = await this.findProductCategoryCatalog(parent.id, language);

    // 대분류는 있는데 소분류가 하나도 없으면 보여줄 게 없다.
    if (catalog.getCount() === 0) return this.buildFallback(context);

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

  private buildFallback(
    context: AiConsultRequestContextDto,
  ): AiConsultAnswerDto {
    return AiConsultAnswerDto.from(
      AI_CONSULT_FALLBACK_MESSAGE[context.language],
      AiConsultAnswerType.FALLBACK,
      null,
      null,
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
      [],
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
        buildAnswerCacheKey(context.question, context.language),
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
        buildAnswerCacheKey(context.question, context.language),
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

    const usage = result?.usage ?? null;

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
      // answerSource 가 LLM 이 아니면(캐시·canned) 호출을 안 했으므로 전부 0 이다.
      promptTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.getOutputTokenCount() ?? 0,
      estimatedCostMicroUsd: usage?.getEstimatedCostMicroUsd() ?? 0,
      // 매칭 실패 질문만 남겨 FAQ 보강 근거로 쓴다(전건 원문 적재 방지).
      question:
        response.answerType === AiConsultAnswerType.FAQ_ANSWER
          ? undefined
          : maskedQuestion,
    });

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

  private persistLog(
    maskedQuestion: string,
    context: AiConsultRequestContextDto,
    response: AiConsultAnswerDto,
    classification: AiConsultClassificationDto | null,
    answerSource: AiConsultAnswerSource,
    result: GeminiStructuredResultDto<unknown> | null,
    usage: GeminiUsageDto | null,
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
        model: result ? Configuration.getConfig().GEMINI_MODEL : null,
        promptTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.getOutputTokenCount() ?? 0,
        estimatedCostMicroUsd: usage?.getEstimatedCostMicroUsd() ?? 0,
        latencyMs: result?.latencyMs ?? 0,
        finishReason: result?.finishReason ?? null,
        errorKind: result?.errorKind ?? null,
        traceId: this.logger.getTraceId(),
        meta: {
          cacheHit: answerSource === AiConsultAnswerSource.ANSWER_CACHE,
          alternatives: classification?.alternatives,
          reason: classification?.reason,
          // faqCode + languageCode + prefaceId 면 고객이 본 answer 를 그대로 재현할 수 있다.
          prefaceId: classification?.prefaceId,
          intent: classification?.intent,
          categoryQuery: classification?.categoryQuery || undefined,
        },
      })
      .catch((error) =>
        this.logger.warn(`Failed to persist AI consult log: ${error.message}`),
      );
  }
}
