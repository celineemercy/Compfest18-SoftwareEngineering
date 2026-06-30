import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, username, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.usersService.create({
      email,
      username,
      password: hashedPassword,
    });

    return this.excludePassword(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: await this.signToken(user),
      user: this.excludePassword(user),
    };
  }

  async selectRole(userId: string, role: Role) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.roles.includes(role)) {
      throw new UnauthorizedException('Role is not available for this user');
    }

    return {
      accessToken: await this.signToken(user, role),
      user: {
        ...this.excludePassword(user),
        activeRole: role,
      },
    };
  }

  private signToken(user: User, activeRole?: Role) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      activeRole,
    });
  }

  private excludePassword(user: User) {
    const { password: _, ...result } = user;
    return result;
  }
}
