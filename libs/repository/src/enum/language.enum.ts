export enum LanguageCode {
  KOREAN = 'ko',
  ENGLISH = 'en',
  TAIWAN = 'zh-TW',
}

export enum LanguageName {
  KOREAN = '한국어',
  ENGLISH = 'English',
  TAIWAN = '中文',
}

export const LANGUAGE_MAP = {
  [LanguageCode.KOREAN]: LanguageName.KOREAN,
  [LanguageCode.ENGLISH]: LanguageName.ENGLISH,
  [LanguageCode.TAIWAN]: LanguageName.TAIWAN,
} as const;

export const DEFAULT_LANGUAGE = LanguageCode.KOREAN;
