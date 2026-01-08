import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { HomeSectionImageEntity } from './home-section-image.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title, description]
 */
@Entity(EntityType.HOME_SECTION)
export class HomeSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: true })
  url: string;

  @Column('varchar', { length: 255, nullable: true })
  urlName: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @OneToMany(
    () => HomeSectionImageEntity,
    (homeSectionImage) => homeSectionImage.section,
    {
      cascade: true,
      eager: true,
    },
  )
  sectionImage: HomeSectionImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}
