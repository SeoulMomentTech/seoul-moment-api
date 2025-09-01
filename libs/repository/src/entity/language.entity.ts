import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { LanguageCode } from '../enum/language.enum';

@Entity('language')
export class LanguageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', {
    enum: LanguageCode,
    default: LanguageCode.KOREAN,
    nullable: false,
    comment: 'Language code (ISO 639-1)',
  })
  code: LanguageCode;

  @Column('varchar', {
    length: 50,
    nullable: false,
    comment: 'Language name in native language',
  })
  name: string;

  @Column('varchar', {
    length: 50,
    nullable: true,
    comment: 'Language name in English',
  })
  englishName: string;

  @Column('boolean', {
    default: true,
    nullable: false,
    comment: 'Whether this language is active',
  })
  isActive: boolean;

  @Column('int', {
    name: 'sort_order',
    default: 1,
    nullable: false,
    comment: 'Display order',
  })
  sortOrder: number;

  @OneToMany(
    () => MultilingualTextEntity,
    (multilingualText) => multilingualText.language,
  )
  multilingualTexts: MultilingualTextEntity[];
}
