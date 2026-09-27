import { JwtType } from '@app/auth/auth.dto';
import { getTokenSubjectId, isUserToken } from '@app/auth/auth.token';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers['authorization'];
    const token = authorization?.replace(/^Bearer\s+/i, '');

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const userId = getTokenSubjectId(payload);

        // 회원 액세스 토큰만 회원으로 본다. 관리자 토큰·refresh 토큰·id 없는
        // 토큰은 익명으로 둔다 (aud 없는 예전 토큰은 isUserToken 참고)
        if (
          payload.jwtType === JwtType.ONE_TIME_TOKEN &&
          isUserToken(payload) &&
          userId !== null
        )
          request.userId = userId;
      } catch {
        // invalid/expired token → treat as anonymous
      }
    }

    return true;
  }
}
