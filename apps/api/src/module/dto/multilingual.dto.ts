import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class MultilingualTextDto {
  @ApiProperty({
    description: 'Language code',
    enum: LanguageCode,
    example: LanguageCode.KOREAN,
  })
  @IsEnum(LanguageCode)
  language: LanguageCode;

  @ApiProperty({
    description: 'Text content',
    example: '서울모먼트',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class MultilingualFieldDto {
  @ApiProperty({
    description: 'Multilingual texts for this field',
    type: [MultilingualTextDto],
  })
  texts: MultilingualTextDto[];

  constructor(texts: MultilingualTextDto[] = []) {
    this.texts = texts;
  }

  static fromByEntity(enitity: MultilingualTextEntity[], fieldName: string) {
    return new MultilingualFieldDto(
      enitity
        .filter((v) => v.fieldName === fieldName)
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );
  }

  getContent(): string | null {
    return this.texts[0]?.content ? this.texts[0].content : null;
  }

  getContentByLanguage(language: LanguageCode): string | null {
    const text = this.texts.find((t) => t.language === language);
    return text ? text.content : null;
  }

  getContentByLanguageWithFallback(
    preferredLanguage: LanguageCode,
    fallbackLanguage: LanguageCode = LanguageCode.KOREAN,
  ): string | null {
    return (
      this.getContentByLanguage(preferredLanguage) ||
      this.getContentByLanguage(fallbackLanguage) ||
      (this.texts.length > 0 ? this.texts[0].content : null)
    );
  }
}
