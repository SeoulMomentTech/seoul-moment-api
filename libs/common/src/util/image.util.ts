import { Configuration } from '@app/config/configuration';

export function stripImageDomain(
  url: string | null | undefined,
): string | null | undefined {
  if (!url) return url;
  return url.replace(Configuration.getConfig().IMAGE_DOMAIN_NAME, '');
}
