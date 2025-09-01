export enum LanguageCode {
  KOREAN = 'ko',
  ENGLISH = 'en',
  CHINESE = 'zh',
}

export enum LanguageName {
  KOREAN = '한국어',
  ENGLISH = 'English',
  CHINESE = '中文',
}

export const LANGUAGE_MAP = {
  [LanguageCode.KOREAN]: LanguageName.KOREAN,
  [LanguageCode.ENGLISH]: LanguageName.ENGLISH,
  [LanguageCode.CHINESE]: LanguageName.CHINESE,
} as const;

export const DEFAULT_LANGUAGE = LanguageCode.KOREAN;