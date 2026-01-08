import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { LanguageEntity } from './language.entity';
import { EntityType } from '../enum/entity.enum';

@Entity('multilingual_text')
@Index(['entityType', 'entityId', 'fieldName'])
@Index(['entityType', 'fieldName', 'textContent'])
@Unique(['entityType', 'entityId', 'fieldName', 'languageId'])
export class MultilingualTextEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', {
    enum: EntityType,
    nullable: false,
    comment: 'Entity type (e.g., Brand, BrandSection)',
  })
  entityType: EntityType;

  @Column('int', {
    name: 'entity_id',
    nullable: false,
    comment: 'ID of the target entity',
  })
  entityId: number;

  @Column('varchar', {
    name: 'field_name',
    length: 50,
    nullable: false,
    comment: 'Field name (e.g., name, description, title, content)',
  })
  fieldName: string;

  @Column('int', {
    name: 'language_id',
    nullable: false,
  })
  languageId: number;

  @Column('text', {
    name: 'text_content',
    nullable: false,
    comment: 'Multilingual text content',
  })
  textContent: string;

  @ManyToOne(() => LanguageEntity, (language) => language.multilingualTexts, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'language_id' })
  language: LanguageEntity;
}
