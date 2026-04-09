import {
  BaseEntity,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

export abstract class CommonEntity extends BaseEntity {
  @Index()
  @CreateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  createDate: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => "(NOW() AT TIME ZONE 'UTC')",
  })
  updateDate: Date;

  @DeleteDateColumn({
    type: 'timestamp with time zone',
    nullable: true,
  })
  deleteDate?: Date;
}
