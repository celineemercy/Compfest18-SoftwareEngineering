import '../config/env';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SellerGuard } from './guards/seller.guard';
import { BuyerGuard } from './guards/buyer.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SellerGuard, BuyerGuard],
  exports: [JwtModule, JwtAuthGuard, SellerGuard, BuyerGuard],
})
export class AuthModule {}
