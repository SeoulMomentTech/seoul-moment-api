import { LoggerService } from '@app/common/log/logger.service';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { UserWithdrawRepositoryService } from '@app/repository/service/user-withdraw.repository.service';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

/**
 * 회원 탈퇴 처리. 유저 본인 탈퇴(`DELETE /user`)와 관리자 강제 탈퇴
 * (`DELETE /admin/member/:userId`) 가 같은 경로를 타도록 공용으로 둔다.
 */
@Injectable()
export class UserWithdrawService {
  constructor(
    private readonly userRepositoryService: UserRepositoryService,
    private readonly userWithdrawRepositoryService: UserWithdrawRepositoryService,
    private readonly s3Service: S3Service,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 회원을 탈퇴시킨다. 이미 탈퇴한 회원은 소프트 삭제되어 조회되지 않으므로
   * NOT_FOUND 로 떨어진다.
   */
  async withdraw(userId: number): Promise<void> {
    const user = await this.userRepositoryService.getUserById(userId);

    const imagePath = await this.withdrawUser(user.id);

    // S3 삭제는 트랜잭션 밖에서 한다. 실패해도 탈퇴 자체는 되돌리지 않는다.
    if (imagePath) {
      await this.removeS3Image(imagePath);
    }

    this.logger.info('User withdrawn', { userId: user.id });
  }

  @Transactional()
  private async withdrawUser(userId: number): Promise<string | null> {
    return await this.userWithdrawRepositoryService.withdrawUser(userId);
  }

  private async removeS3Image(imagePath: string): Promise<void> {
    const key = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

    try {
      await this.s3Service.deleteFile(key);
    } catch (error) {
      this.logger.warn('Failed to delete S3 object during user withdrawal', {
        key,
        error: error.message,
      });
    }
  }
}
