import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OptionalUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);
