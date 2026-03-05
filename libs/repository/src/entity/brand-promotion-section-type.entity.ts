import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';

import { BrandPromotionSectionEntity } from './brand-promotion-section.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_promotion_section_type')
export class BrandPromotionSectionTypeEntity extends CommonEntity {
  @PrimaryColumn('varchar', { length: 255, nullable: false })
  id: string;

  @Column('varchar', { length: 255, nullable: false })
  description: string;

  @Column('int', { default: 0, nullable: false })
  imageCount: number;

  @OneToMany(() => BrandPromotionSectionEntity, (section) => section.type, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  sections: BrandPromotionSectionEntity[];
}
