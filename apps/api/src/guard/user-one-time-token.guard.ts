import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class UserOneTimeTokenGuard extends AuthGuard('user_one_time_token') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
