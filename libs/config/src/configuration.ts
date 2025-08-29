import { ConfigImpl } from './configImpl';
import { SupportEnv } from './enum/config.enum';
import dev from './env/dev';
import local from './env/local';
import prod from './env/prod';
import test from './env/test';

export class Configuration {
  static getConfig(): ConfigImpl {
    const env = process.env.NODE_ENV as SupportEnv;

    let config: ConfigImpl;
    switch (env) {
      case SupportEnv.LOCAL:
        config = local();
        break;
      case SupportEnv.DEV:
        config = dev();
        break;
      case SupportEnv.TEST:
        config = test();
        break;
      case SupportEnv.PROD:
        config = prod();
        break;
      default:
        config = local();
        break;
    }

    return config;
  }
}
