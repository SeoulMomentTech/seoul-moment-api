import { Transform } from 'class-transformer';

/**
 * 요청 값이 빈 문자열('')이면 null로 변환한다.
 * @IsOptional()과 함께 사용하면 빈 값이 검증을 통과하고 null로 저장된다.
 */
export const EmptyStringToNull = () =>
  Transform(({ value }) => (value === '' ? null : value));
