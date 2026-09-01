import { JwtType } from '@app/auth/auth.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanUserStatus } from '@app/repository/enum/plan-user.enum';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * DB 에서 읽어 온 timestamp 가 "오늘" 것인지 본다.
 *
 * 이 프로젝트의 `timestamp` 컬럼에는 타임존이 없다. 드라이버는 **쓸 때
 * 프로세스 로컬 시각의 벽시계를 그대로** 넣고(컨테이너는 `TZ=Asia/Seoul` 로
 * 뜬다), **읽을 때는** `DatabaseService` 의 파서가 거기에 'Z' 를 붙여 UTC 로
 * 해석한다. 그래서 읽어 온 Date 의 **UTC 필드가 저장 당시의 로컬 달력 날짜**다.
 *
 * 두 값을 각각 그 규칙대로 읽어야 한다 — 저장분은 UTC 필드로, 지금 시각은
 * 로컬 필드로. 한쪽만 보면 타임존만큼(9시간) 어긋나서, 오후에 들어온
 * 사용자는 갱신을 건너뛰지 못하고 매 요청 UPDATE 를 맞는다.
 */
function isStoredToday(stored: Date, now: Date): boolean {
  return (
    stored.getUTCFullYear() === now.getFullYear() &&
    stored.getUTCMonth() === now.getMonth() &&
    stored.getUTCDate() === now.getDate()
  );
}

/**
 * 플랜 API 인증 가드.
 *
 * **세션은 우리 JWT 하나로 선다. 카카오는 로그인할 때 "누구인지" 를 확인하는
 * 수단일 뿐이고, 그 뒤로는 관여하지 않는다.**
 *
 * 예전에는 로그인 때 받은 카카오 access_token 을 JWT payload 에 넣어 두고
 * 매 요청마다 카카오 서버에 유효성을 물었다. 그래서 세 가지가 한꺼번에 걸렸다.
 *
 * 1. **6시간마다 로그아웃.** 카카오 access_token 수명이 6시간인데 갱신 경로가
 *    없어서, 우리 JWT 가 100년짜리여도 실효 세션은 6시간이었다. 탭을 닫지
 *    않아도 점심 먹고 오면 끊겼다.
 * 2. **카카오 장애 = 우리 서비스 장애.** 모든 요청이 외부 왕복을 탔다.
 * 3. **카카오 토큰 유출.** JWT payload 는 base64 라 누구나 꺼내 읽고, 그걸로
 *    카카오 API 를 직접 부를 수 있었다.
 *
 * 지금은 서명·만료·토큰 세대만 보고 `planUserId` 로 사용자를 찾는다.
 * 토큰을 되돌려 받아야 할 때는 `plan_user.token_version` 을 올린다
 * (`POST /plan/auth/logout/all`, 회원 탈퇴).
 *
 * **여기에 카카오 호출을 다시 넣지 마세요.** 로그인 상태를 남의 토큰 수명에
 * 다시 매다는 일입니다.
 */
@Injectable()
export class PlanApiGuard implements CanActivate {
  constructor(
    @Inject()
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    @Inject()
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new ServiceError('Token not found', ServiceErrorCode.UNAUTHORIZED);
    }

    const token = authorization.split(' ')[1];

    if (!token) {
      throw new ServiceError('Token not found', ServiceErrorCode.UNAUTHORIZED);
    }

    let payload: Record<string, any>;
    try {
      payload = this.jwtService.verify(token);
    } catch (error) {
      throw new ServiceError(
        `Invalid token: ${error.message}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    // 같은 JWT_SECRET 으로 서명되는 다른 용도의 토큰(가입·SNS 연동 등)이
    // 플랜 API 에 그대로 통하지 않게 한다.
    if (payload.jwtType !== JwtType.ONE_TIME_TOKEN) {
      throw new ServiceError(
        'Invalid token type',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    request.user = await this.getPlanUser(payload);

    return true;
  }

  private async getPlanUser(
    payload: Record<string, any>,
  ): Promise<PlanUserEntity> {
    const planUserId = payload.planUserId;

    if (!planUserId || typeof planUserId !== 'string') {
      throw new ServiceError('Invalid token', ServiceErrorCode.UNAUTHORIZED);
    }

    const planUser = await this.planUserRepositoryService.findById(planUserId);

    // 탈퇴한 사용자는 소프트 삭제라 조회 자체가 비어서 온다.
    if (!planUser) {
      throw new ServiceError(
        `Plan user not found planUserId: ${planUserId}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    if (planUser.status !== PlanUserStatus.NORMAL) {
      throw new ServiceError(
        `Plan user is not active planUserId: ${planUserId}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    // 회수된 토큰인지 본다. 이 클레임이 없던 시절의 토큰은 0 으로 읽어
    // 그대로 통과시킨다 — 이번 배포로 기존 사용자를 로그아웃시키지 않는다.
    if ((payload.tokenVersion ?? 0) !== (planUser.tokenVersion ?? 0)) {
      throw new ServiceError(
        'Token has been revoked',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    await this.touchLastLoginDate(planUser);

    return planUser;
  }

  /**
   * 마지막 접속 일시는 **하루에 한 번만** 쓴다.
   *
   * 예전에는 매 요청마다 UPDATE 를 날려, 화면 하나 여는 데도 쓰기가 여러 번
   * 붙었다. 이 값은 "언제 마지막으로 왔나" 를 보는 용도라 그 정밀도가 필요 없다.
   */
  private async touchLastLoginDate(planUser: PlanUserEntity): Promise<void> {
    const now = new Date();

    if (planUser.lastLoginDate && isStoredToday(planUser.lastLoginDate, now)) {
      return;
    }

    await this.planUserRepositoryService.touchLastLoginDate(planUser.id, now);
    planUser.lastLoginDate = now;
  }
}
