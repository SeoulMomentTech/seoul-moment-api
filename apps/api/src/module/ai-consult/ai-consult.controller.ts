import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Request } from 'express';

import {
  PostAiConsultAskRequest,
  PostAiConsultAskResponse,
} from './ai-consult.dto';
import { AiConsultService } from './ai-consult.service';
import { OptionalUserId } from '../../decorator/optional-user.decorator';
import { OptionalUserGuard } from '../../guard/optional-user.guard';

@Controller('ai-consult')
export class AiConsultController {
  constructor(private readonly aiConsultService: AiConsultService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'AI 상담 질문',
    description:
      '사전 정의된 FAQ 지식에서 의미 기반으로 답변을 찾아 반환합니다. ' +
      '단발성 질문-답변이며 이전 대화를 기억하지 않습니다. ' +
      '쇼핑몰과 무관한 질문은 거절합니다. ' +
      '레이트리밋·LLM 장애 상황에서도 200 으로 응답하며 answerType 으로 구분합니다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: false,
    description: '응답 언어 (ko, en, zh-TW). 없으면 ko',
    enum: LanguageCode,
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description:
      'JWT token 이곳에 토큰을 쓰지 말고 실제 사용은 swagger 자물쇠를 사용',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(OptionalUserGuard)
  @ResponseData(PostAiConsultAskResponse)
  @ResponseException(HttpStatus.BAD_REQUEST, '메시지 길이 오류 (2~300자)')
  async postAiConsultAsk(
    @Body() body: PostAiConsultAskRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @OptionalUserId() userId: number | undefined,
    @Req() request: Request,
  ): Promise<ResponseDataDto<PostAiConsultAskResponse>> {
    const result = await this.aiConsultService.postAsk(
      body,
      acceptLanguage,
      userId,
      request,
    );

    return new ResponseDataDto(result);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'AI 상담 시작 질문 목록',
    description:
      '챗 위젯을 처음 열었을 때 노출할 추천 질문 칩을 반환합니다. ' +
      'LLM 을 호출하지 않는 정적 목록이라 비용이 들지 않고 응답이 즉시 나갑니다. ' +
      '유저가 칩을 누르면 해당 title 을 POST /ai-consult/ask 의 message 로 보내면 됩니다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: false,
    description: '응답 언어 (ko, en, zh-TW). 없으면 ko',
    enum: LanguageCode,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      properties: {
        result: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 3 },
            list: {
              type: 'array',
              items: { type: 'string' },
              example: ['배송 기간', '환불 방법', '사이즈 확인'],
            },
          },
        },
      },
    },
  })
  getAiConsultSuggestions(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): ResponseListDto<string> {
    return new ResponseListDto(
      this.aiConsultService.getInitialSuggestions(acceptLanguage),
    );
  }
}
