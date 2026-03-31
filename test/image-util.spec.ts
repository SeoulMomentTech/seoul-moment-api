import { Configuration } from '@app/config/configuration';

import { stripImageDomain } from '../libs/common/src/util/image.util';

jest.spyOn(Configuration, 'getConfig').mockReturnValue({
  IMAGE_DOMAIN_NAME: 'https://image.seoulmoment.com',
} as any);

describe('stripImageDomain (단위 테스트)', () => {
  it('도메인이 포함된 URL에서 도메인을 제거한다', () => {
    // Given
    const url = 'https://image.seoulmoment.com/brand/profile.jpg';

    // When
    const result = stripImageDomain(url);

    // Then
    expect(result).toBe('/brand/profile.jpg');
  });

  it('도메인이 없는 상대 경로는 그대로 반환한다', () => {
    // Given
    const url = '/brand/profile.jpg';

    // When
    const result = stripImageDomain(url);

    // Then
    expect(result).toBe('/brand/profile.jpg');
  });

  it('null을 전달하면 null을 반환한다', () => {
    // Given
    const url = null;

    // When
    const result = stripImageDomain(url);

    // Then
    expect(result).toBeNull();
  });

  it('undefined를 전달하면 undefined를 반환한다', () => {
    // Given
    const url = undefined;

    // When
    const result = stripImageDomain(url);

    // Then
    expect(result).toBeUndefined();
  });

  it('빈 문자열을 전달하면 빈 문자열을 반환한다', () => {
    // Given
    const url = '';

    // When
    const result = stripImageDomain(url);

    // Then
    expect(result).toBe('');
  });
});
