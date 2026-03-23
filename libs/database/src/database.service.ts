import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { types } from 'pg';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const TIMESTAMP_WITHOUT_TIMEZONE_OID = 1114;

@Injectable()
export class DatabaseService implements TypeOrmOptionsFactory {
  constructor() {
    types.setTypeParser(
      TIMESTAMP_WITHOUT_TIMEZONE_OID,
      (stringValue: string) =>
        stringValue ? new Date(`${stringValue}Z`) : null,
    );
  }

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: true,
      namingStrategy: new SnakeNamingStrategy(),
      logging: false,
      parseInt8: true,
    };
  }
}
