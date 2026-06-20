import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async register(registerDto: RegisterDto) {
    const { email, username, password } = registerDto;

    // 1. Hash the password (10 salt rounds is standard for security/speed)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Save the user to the database
    const user = await this.usersService.create({
      email,
      username,
      password: hashedPassword,
    });

    // 3. Remove the password from the object before returning it to the frontend!
    const { password: _, ...result } = user;
    return result;
  }
}