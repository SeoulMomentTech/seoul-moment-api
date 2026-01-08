import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OneTimeTokenGuard extends AuthGuard('one_time_token') {}
