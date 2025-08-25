import moment from 'moment';
import { BaseEntity, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';

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

  createDateToString(): string {
    return moment(this.createDate).format('YYYY-MM-DD hh:mm:ss');
  }

  updateDateToString(): string {
    return moment(this.updateDate).format('YYYY-MM-DD hh:mm:ss');
  }
}
