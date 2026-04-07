import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OneTimeTokenGuard extends AuthGuard('one_time_token') {
  canActivate(context: ExecutionContext) {
    if (Configuration.getConfig().NODE_ENV === SupportEnv.LOCAL) {
      return true;
    }
    return super.canActivate(context);
  }
}
