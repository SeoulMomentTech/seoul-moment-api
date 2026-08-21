import { Injectable } from '@nestjs/common';

import { UserWithdrawService } from '../../user/withdraw/user.withdraw.service';

@Injectable()
export class AdminMemberService {
  constructor(private readonly userWithdrawService: UserWithdrawService) {}

  /** 관리자 강제 탈퇴. 유저 본인 탈퇴와 동일한 처리를 수행한다. */
  async withdrawMember(userId: number): Promise<void> {
    await this.userWithdrawService.withdraw(userId);
  }
}
