import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // 1. Import the module file

@Module({
  imports: [UsersModule], // 2. Add it to the imports array!
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}