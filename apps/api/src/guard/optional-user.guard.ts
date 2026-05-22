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
        request.userId = Number(payload.id);
      } catch {
        // invalid/expired token → treat as anonymous
      }
    }

    return true;
  }
}
