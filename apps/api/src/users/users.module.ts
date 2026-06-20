import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // This is required so AuthModule is allowed to use it!
})
export class UsersModule {}