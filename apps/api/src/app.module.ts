import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { CatalogModule } from './catalog/catalog.module';
import { WalletModule } from './wallet/wallet.module';
import { AddressesModule } from './addresses/addresses.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StoresModule,
    ProductsModule,
    CatalogModule,
    WalletModule,
    AddressesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
