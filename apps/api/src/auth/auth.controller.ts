import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-role')
  async selectRole(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SelectRoleDto,
  ) {
    return this.authService.selectRole(request.user.id, dto.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
