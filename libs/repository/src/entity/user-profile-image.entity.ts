import { Configuration } from '@app/config/configuration';
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { UserProfileEntity } from './user-profile.entity';

@Entity('user_profile_image')
export class UserProfileImageEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    comment: '사용자 ID (PK, user.id 참조)',
  })
  userId: number;

  @Column('varchar', {
    length: 500,
    nullable: false,
    comment: '프로필 이미지 경로',
  })
  imagePath: string;

  @OneToOne(() => UserProfileEntity, (userProfile) => userProfile.image, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  userProfile: UserProfileEntity;

  getImageUrl(): string {
    return this.imagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`
      : null;
  }
}
