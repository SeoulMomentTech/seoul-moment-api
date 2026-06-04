import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ProductLikeCountModule } from './like-count/product-like-count.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { OptionalUserGuard } from '../../guard/optional-user.guard';

@Module({
  imports: [
    RepositoryModule,
    JwtModule.register({
      secret: Configuration.getConfig().JWT_SECRET,
    }),
    ProductLikeCountModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, OptionalUserGuard],
  exports: [ProductService],
})
export class ProductModule {}
