import { Injectable, Logger } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { types } from 'pg';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const TIMESTAMP_WITHOUT_TIMEZONE_OID = 1114;

@Injectable()
export class DatabaseService implements TypeOrmOptionsFactory {
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    types.setTypeParser(
      TIMESTAMP_WITHOUT_TIMEZONE_OID,
      (stringValue: string) =>
        stringValue ? new Date(`${stringValue}Z`) : null,
    );
  }

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const host = process.env.DATABASE_HOST;
    const port = parseInt(process.env.DATABASE_PORT || '5432');
    const database = process.env.DATABASE_NAME;
    const username = process.env.DATABASE_USERNAME;

    this.logger.log(
      `🗄️  [PostgreSQL] 연결 시도: ${host}:${port}/${database} (user: ${username})`,
    );

    return {
      type: 'postgres',
      host,
      port,
      username,
      password: process.env.DATABASE_PASSWORD,
      database,
      autoLoadEntities: true,
      synchronize: true,
      namingStrategy: new SnakeNamingStrategy(),
      logging: false,
      parseInt8: true,
    };
  }
}
